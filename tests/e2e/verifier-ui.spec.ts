import { generateKeyPairSync } from 'node:crypto';
import { expect, test as base, type Page } from '@playwright/test';

interface BrowserFile { name: string; mimeType: string; buffer: Buffer }
interface PublicJwk { kty: string; crv: string; x: string; y: string; kid: string; alg?: string; use?: string }
interface ReceiptFixture {
  reference: string;
  receipt: BrowserFile;
  photos: BrowserFile[];
  keys: BrowserFile;
  keyCount: number;
  foreignKeys: BrowserFile;
  wrongMaterialKeys: BrowserFile;
}
interface VerifierPage { page: Page; fixture: ReceiptFixture }
interface DeferredFileRead { started: boolean; release: () => void; finished: Promise<void> }
interface DeferredDigest { started: boolean; release: () => void }
type ControlledVerifierWindow = Window & { deferredVerifierRead?: DeferredFileRead; deferredVerifierDigest?: DeferredDigest };

const jsonFile = (name: string, value: unknown): BrowserFile => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
const receiptFile = (jws: string): BrowserFile => ({ name: 'receipt.jws', mimeType: 'application/jose', buffer: Buffer.from(jws) });

const test = base.extend<{ verifier: VerifierPage }, { receiptFixture: ReceiptFixture }>({
  receiptFixture: [async ({ browser, playwright }, use, workerInfo) => {
    const baseURL = workerInfo.project.use.baseURL;
    if (typeof baseURL !== 'string') throw new Error('A loopback test baseURL is required.');
    const origin = new URL(baseURL).origin;
    // Real receipt generation is restricted to the isolated local e2e API.
    expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(baseURL).hostname);
    const api = await playwright.request.newContext({ baseURL });
    const canvasPage = await browser.newPage();
    try {
      const bootstrap = await api.get('/api/bootstrap');
      expect(bootstrap.ok()).toBe(true);
      const { csrfToken } = await bootstrap.json() as { csrfToken: string };
      const headers = { Origin: origin, 'X-CSRF-TOKEN': csrfToken };
      const reference = `VERIFY-UI-${crypto.randomUUID().slice(0, 8)}`;
      const created = await api.post('/api/sessions', { headers, data: { category: 'vinyl', businessReference: reference, direct: true } });
      expect(created.ok()).toBe(true);
      const { id } = await created.json() as { id: string };
      const photos: BrowserFile[] = [];
      for (const color of ['#196c50', '#3456a2', '#c05f37']) {
        // Synthetic JPEGs are generated in memory, never read from a user's folders.
        const base64 = await canvasPage.evaluate(value => {
          const canvas = document.createElement('canvas');
          canvas.width = 32; canvas.height = 32;
          const context = canvas.getContext('2d')!;
          context.fillStyle = value; context.fillRect(0, 0, 32, 32);
          return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]!;
        }, color);
        const buffer = Buffer.from(base64, 'base64');
        const uploadId = crypto.randomUUID();
        const reserved = await api.post(`/api/sessions/${id}/uploads`, { headers, data: { uploadId } });
        expect(reserved.ok()).toBe(true);
        const reservation = await reserved.json() as { authorization: string };
        const uploaded = await api.put(`/api/sessions/${id}/uploads/${uploadId}`, {
          headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Upload-Authorization': reservation.authorization }, data: buffer,
        });
        expect(uploaded.ok()).toBe(true);
        const photo = await uploaded.json() as { id: string };
        const downloaded = await api.get(`/api/sessions/${id}/photos/${photo.id}`);
        expect(downloaded.ok()).toBe(true);
        expect(downloaded.headers()['content-type']).toContain('image/jpeg');
        expect(downloaded.headers()['content-disposition']).toContain(`${photo.id}.jpg`);
        const originalBytes = await downloaded.body();
        expect(originalBytes.equals(buffer)).toBe(true);
        photos.push({ name: `${photo.id}.jpg`, mimeType: 'image/jpeg', buffer: originalBytes });
      }
      const finalized = await api.post(`/api/sessions/${id}/finalize`, { headers, data: {} });
      expect(finalized.ok()).toBe(true);
      const { jws } = await finalized.json() as { jws: string };
      const downloadedReceipt = await api.get(`/api/sessions/${id}/receipt`);
      expect(downloadedReceipt.ok()).toBe(true);
      const savedReceipt = await downloadedReceipt.json() as { jws: string };
      expect(savedReceipt.jws).toBe(jws);
      const response = await api.get('/api/keys');
      expect(response.ok()).toBe(true);
      const { keys } = await response.json() as { keys: PublicJwk[] };
      const header = JSON.parse(Buffer.from(jws.split('.')[0]!, 'base64url').toString('utf8')) as { kid: string };
      expect(keys.some(key => key.kid === header.kid)).toBe(true);
      const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const publicParameters = publicKey.export({ format: 'jwk' });
      const foreignKey: PublicJwk = { kty: 'EC', crv: 'P-256', x: publicParameters.x!, y: publicParameters.y!, kid: 'unrelated-ui-test-key', alg: 'ES256', use: 'sig' };
      expect(keys.some(key => key.kid === foreignKey.kid)).toBe(false);
      await use({
        reference, receipt: receiptFile(savedReceipt.jws), photos, keys: jsonFile('public-keys.json', { keys }), keyCount: keys.length,
        foreignKeys: jsonFile('foreign-keys.json', { keys: [foreignKey] }),
        wrongMaterialKeys: jsonFile('wrong-material-keys.json', { keys: [{ ...foreignKey, kid: header.kid }] }),
      });
    } finally {
      await canvasPage.close();
      await api.dispose();
    }
  }, { scope: 'worker' }],
  verifier: async ({ page, receiptFixture }, use) => {
    const apiRequests: string[] = [];
    await page.route(/\/(?:api|hubs)(?:\/|$)/, async route => {
      apiRequests.push(new URL(route.request().url()).pathname);
      await route.abort();
    });
    await page.goto('/verify');
    await page.getByLabel(/1\. Clés publiques de confiance/).setInputFiles(receiptFixture.keys);
    await page.getByLabel(/2\. Reçu signé/).setInputFiles(receiptFixture.receipt);
    await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles(receiptFixture.photos);
    await page.getByLabel('Espace attendu', { exact: true }).fill('demo');
    await page.getByLabel('Référence métier attendue, facultative', { exact: true }).fill(receiptFixture.reference);
    await expect(page.getByText(`${receiptFixture.keyCount} clé(s) importée(s) explicitement`, { exact: true })).toBeVisible();
    await expect(page.getByText('Reçu chargé localement', { exact: true })).toBeVisible();
    await use({ page, fixture: receiptFixture });
    // A verifier file selection must never upload photo bytes or discover trust through the API.
    expect(apiRequests).toEqual([]);
  },
});

async function check(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Vérifier localement', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByTestId('verification-result')).toBeVisible();
}

async function deferFileText(page: Page, filename: string): Promise<void> {
  await page.evaluate(name => {
    const target = window as ControlledVerifierWindow;
    let release!: () => void;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const finished = new Promise<void>(resolve => { finish = resolve; });
    target.deferredVerifierRead = { started: false, release, finished };
    const original = File.prototype.text;
    File.prototype.text = function (): Promise<string> {
      const contents = original.call(this);
      if (this.name !== name) return contents;
      target.deferredVerifierRead!.started = true;
      return pending.then(() => contents).finally(finish);
    };
  }, filename);
}

async function releaseFileText(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const state = (window as ControlledVerifierWindow).deferredVerifierRead!;
    state.release();
    await state.finished;
  });
}

async function expectStatus(page: Page, label: string, value: string): Promise<void> {
  const row = page.locator('.results > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) });
  await expect(row.locator('dd')).toHaveText(value);
}

async function expectValid(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Intégrité vérifiée', exact: true })).toBeVisible();
  for (const label of ['Signature', 'Format du reçu', 'Fichiers', 'Contexte']) await expectStatus(page, label, 'Conforme');
  await expectStatus(page, 'Clé de confiance', 'Reconnue');
  await expect(page.getByTestId('verification-issues').locator('li')).toHaveCount(0);
}

async function expectFileIssue(page: Page, code: string, label: string, filename: string, count = 1): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Vérification à examiner', exact: true })).toBeVisible();
  await expectStatus(page, 'Signature', 'Conforme');
  await expectStatus(page, 'Clé de confiance', 'Reconnue');
  await expectStatus(page, 'Format du reçu', 'Conforme');
  await expectStatus(page, 'Fichiers', 'Non conforme');
  await expectStatus(page, 'Contexte', 'Conforme');
  const issues = page.getByTestId('verification-issues');
  await expect(issues.locator('li')).toHaveCount(count);
  const issue = issues.locator(`li[data-code="${code}"]`);
  await expect(issue).toContainText(label);
  await expect(issue).toContainText(filename);
}

test('verifier UI accepts the real API receipt and three exact synthetic originals without API calls', async ({ verifier }) => {
  await check(verifier.page);
  await expectValid(verifier.page);
});

test('verifier UI rejects altered photo bytes of unchanged length and identifies their filename', async ({ verifier: { page, fixture } }) => {
  const first = fixture.photos[0]!;
  const altered = Buffer.from(first.buffer);
  altered[Math.floor(altered.length / 2)] = altered[Math.floor(altered.length / 2)]! ^ 1;
  expect(altered.length).toBe(first.buffer.length);
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles([{ ...first, buffer: altered }, ...fixture.photos.slice(1)]);
  await check(page);
  await expectFileIssue(page, 'digest-mismatch', 'Contenu modifié', first.name);
});

test('verifier UI identifies a photo with a changed byte length', async ({ verifier: { page, fixture } }) => {
  const first = fixture.photos[0]!;
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles([{ ...first, buffer: Buffer.concat([first.buffer, Buffer.from([0])]) }, ...fixture.photos.slice(1)]);
  await check(page);
  await expectFileIssue(page, 'size-mismatch', 'Taille différente', first.name);
});

test('verifier UI rejects a changed receipt payload before checking its file set or context', async ({ verifier: { page, fixture } }) => {
  const parts = fixture.receipt.buffer.toString('utf8').split('.');
  const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
  const alteredReference = fixture.reference.slice(0, -1) + (fixture.reference.endsWith('A') ? 'B' : 'A');
  const changed = payload.replace(`"businessReference":"${fixture.reference}"`, `"businessReference":"${alteredReference}"`);
  expect(changed).not.toBe(payload);
  parts[1] = Buffer.from(changed).toString('base64url');
  await page.getByLabel(/2\. Reçu signé/).setInputFiles(receiptFile(parts.join('.')));
  await check(page);
  await expectStatus(page, 'Signature', 'Non conforme');
  await expectStatus(page, 'Clé de confiance', 'Reconnue');
  for (const label of ['Format du reçu', 'Fichiers', 'Contexte']) await expectStatus(page, label, 'Non contrôlé');
  await expect(page.getByText('Aucun contexte attendu fourni', { exact: true })).toHaveCount(0);
});

test('verifier UI rejects a wrong expected business reference while keeping exact files and signature valid', async ({ verifier: { page } }) => {
  await page.getByLabel('Référence métier attendue, facultative', { exact: true }).fill('WRONG-REFERENCE');
  await check(page);
  for (const label of ['Signature', 'Format du reçu', 'Fichiers']) await expectStatus(page, label, 'Conforme');
  await expectStatus(page, 'Clé de confiance', 'Reconnue');
  await expectStatus(page, 'Contexte', 'Non conforme');
  await expect(page.getByRole('heading', { name: 'Vérification à examiner', exact: true })).toBeVisible();
});

test('verifier UI names the missing original photo', async ({ verifier: { page, fixture } }) => {
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles(fixture.photos.slice(0, 2));
  await check(page);
  await expectFileIssue(page, 'missing-file', 'Fichier manquant', fixture.photos[2]!.name);
});

test('verifier UI names an unexpected extra photo', async ({ verifier: { page, fixture } }) => {
  const extra = { ...fixture.photos[0]!, name: 'unexpected-photo.jpg' };
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles([...fixture.photos, extra]);
  await check(page);
  await expectFileIssue(page, 'extra-file', 'Fichier supplémentaire', extra.name);
});

test('verifier UI rejects an exact duplicate filename even when its bytes are identical', async ({ verifier: { page, fixture } }) => {
  const duplicate = { ...fixture.photos[0]!, buffer: Buffer.from(fixture.photos[0]!.buffer) };
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles([...fixture.photos, duplicate]);
  await check(page);
  await expectFileIssue(page, 'duplicate-file', 'Fichier en double', duplicate.name);
});

test('verifier UI explains both differences from renaming an otherwise identical photo', async ({ verifier: { page, fixture } }) => {
  const renamed = { ...fixture.photos[0]!, name: 'renamed-photo.jpg' };
  await page.getByLabel(/3\. Toutes les photos originales/).setInputFiles([renamed, ...fixture.photos.slice(1)]);
  await check(page);
  await expectFileIssue(page, 'extra-file', 'Fichier supplémentaire', renamed.name, 2);
  await expectFileIssue(page, 'missing-file', 'Fichier manquant', fixture.photos[0]!.name, 2);
});

test('verifier UI refuses an unrelated public key identifier without checking the signature', async ({ verifier: { page, fixture } }) => {
  await page.getByLabel(/1\. Clés publiques de confiance/).setInputFiles(fixture.foreignKeys);
  await check(page);
  await expectStatus(page, 'Clé de confiance', 'Inconnue');
  for (const label of ['Signature', 'Format du reçu', 'Fichiers', 'Contexte']) await expectStatus(page, label, 'Non contrôlé');
  await expect(page.getByRole('heading', { name: 'Vérification à examiner', exact: true })).toBeVisible();
});

test('verifier UI cryptographically rejects another public key carrying the legitimate identifier', async ({ verifier: { page, fixture } }) => {
  await page.getByLabel(/1\. Clés publiques de confiance/).setInputFiles(fixture.wrongMaterialKeys);
  await check(page);
  await expectStatus(page, 'Clé de confiance', 'Reconnue');
  await expectStatus(page, 'Signature', 'Non conforme');
  for (const label of ['Format du reçu', 'Fichiers', 'Contexte']) await expectStatus(page, label, 'Non contrôlé');
});

test('verifier UI clears stale success when context changes and can verify the originals again', async ({ verifier: { page, fixture } }) => {
  await check(page);
  await expectValid(page);
  const reference = page.getByLabel('Référence métier attendue, facultative', { exact: true });
  await reference.fill('WRONG-REFERENCE');
  await expect(page.getByRole('heading', { name: 'Intégrité vérifiée', exact: true })).toHaveCount(0);
  await check(page);
  await expectStatus(page, 'Contexte', 'Non conforme');
  await reference.fill(fixture.reference);
  await expect(page.getByTestId('verification-result')).toHaveCount(0);
  await check(page);
  await expectValid(page);
});

test('verifier UI ignores an older receipt read that finishes after the new selection', async ({ verifier: { page, fixture } }) => {
  const delayed = { name: 'delayed-receipt.jws', mimeType: 'application/jose', buffer: Buffer.from('not-a-signed-receipt') };
  await deferFileText(page, delayed.name);
  const input = page.getByLabel(/2\. Reçu signé/);
  await input.setInputFiles(delayed);
  await expect.poll(() => page.evaluate(() => (window as ControlledVerifierWindow).deferredVerifierRead!.started)).toBe(true);
  await expect(page.getByRole('button', { name: 'Vérifier localement', exact: true })).toBeDisabled();
  await input.setInputFiles(fixture.receipt);
  await expect(page.getByRole('button', { name: 'Vérifier localement', exact: true })).toBeEnabled();
  await releaseFileText(page);
  await check(page);
  await expectValid(page);
});

test('verifier UI ignores an older key read that finishes after the new selection', async ({ verifier: { page, fixture } }) => {
  const delayed = { ...fixture.foreignKeys, name: 'delayed-keys.json' };
  await deferFileText(page, delayed.name);
  const input = page.getByLabel(/1\. Clés publiques de confiance/);
  await input.setInputFiles(delayed);
  await expect.poll(() => page.evaluate(() => (window as ControlledVerifierWindow).deferredVerifierRead!.started)).toBe(true);
  await expect(page.getByRole('button', { name: 'Vérifier localement', exact: true })).toBeDisabled();
  await input.setInputFiles(fixture.keys);
  await expect(page.getByRole('button', { name: 'Vérifier localement', exact: true })).toBeEnabled();
  await releaseFileText(page);
  await check(page);
  await expectValid(page);
});

test('verifier UI discards verification results completed after the expected context changes', async ({ verifier: { page, fixture } }) => {
  await page.evaluate(() => {
    const target = window as ControlledVerifierWindow;
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    target.deferredVerifierDigest = { started: false, release };
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let deferred = false;
    crypto.subtle.digest = async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
      if (!deferred) {
        deferred = true;
        target.deferredVerifierDigest!.started = true;
        await pending;
      }
      return original(algorithm, data);
    };
  });
  const button = page.getByRole('button', { name: 'Vérifier localement', exact: true });
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as ControlledVerifierWindow).deferredVerifierDigest!.started)).toBe(true);
  const reference = page.getByLabel('Référence métier attendue, facultative', { exact: true });
  await reference.fill('WRONG-REFERENCE');
  await page.evaluate(() => (window as ControlledVerifierWindow).deferredVerifierDigest!.release());
  await expect(button).toBeEnabled();
  await expect(page.getByTestId('verification-result')).toHaveCount(0);
  await check(page);
  await expectStatus(page, 'Contexte', 'Non conforme');
  await reference.fill(fixture.reference);
  await check(page);
  await expectValid(page);
});
