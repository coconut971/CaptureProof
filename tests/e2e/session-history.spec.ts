import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}
const reference = (suffix: string): string => `HISTORY-${suffix}-${crypto.randomUUID().slice(0, 8)}`;
const recentRow = (page: Page, value: string) => page.locator('.recent-row').filter({ hasText: value });

async function createSession(page: Page, value: string): Promise<string> {
  await page.getByLabel('Référence métier').fill(value);
  const created = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/sessions');
  await page.getByRole('button', { name: 'Créer une session', exact: true }).click();
  const response = await created;
  expect(response.ok()).toBe(true);
  const session = await response.json() as { id: string };
  await expect(page.getByRole('button', { name: 'Régénérer le QR code', exact: true })).toBeEnabled();
  return session.id;
}
async function mutationHeaders(api: APIRequestContext, origin: string): Promise<Record<string, string>> {
  const response = await api.get('/api/bootstrap');
  expect(response.ok()).toBe(true);
  const { csrfToken } = await response.json() as { csrfToken: string };
  return { Origin: origin, 'X-CSRF-TOKEN': csrfToken };
}
async function uploadSyntheticPhoto(page: Page, api: APIRequestContext, id: string, headers: Record<string, string>): Promise<void> {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
    const drawing = canvas.getContext('2d')!;
    drawing.fillStyle = '#285b8c'; drawing.fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]!;
  });
  const uploadId = crypto.randomUUID();
  const reserved = await api.post(`/api/sessions/${id}/uploads`, { headers, data: { uploadId } });
  expect(reserved.ok()).toBe(true);
  const { authorization } = await reserved.json() as { authorization: string };
  const uploaded = await api.put(`/api/sessions/${id}/uploads/${uploadId}`, {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Upload-Authorization': authorization }, data: Buffer.from(encoded, 'base64'),
  });
  expect(uploaded.ok()).toBe(true);
}

test('returning to the dossier list shows cancellation once with the current state', async ({ page }) => {
  const value = reference('CANCEL');
  await page.goto('/'); await createSession(page, value);
  await page.getByRole('button', { name: 'Annuler la session', exact: true }).click();
  await expect(page.getByTestId('session-state')).toHaveText('Session annulée');
  await page.getByRole('button', { name: 'Créer un autre dossier', exact: true }).click();
  await expect(recentRow(page, value)).toHaveCount(1);
  await expect(recentRow(page, value)).toContainText('Session annulée');
});

test('a delayed confirmation cannot reopen a finalized dossier or its history row', async ({ page, playwright, baseURL }) => {
  const value = reference('FINAL');
  await page.goto('/'); const id = await createSession(page, value);
  await page.getByText('Accès manuel à l’invitation', { exact: true }).click();
  const invitation = new URL((await page.getByTestId('invitation-link').getAttribute('href'))!);
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(new URL(baseURL!).hostname);
  const phone = await playwright.request.newContext({ baseURL });
  const confirmationHeld = deferred(); const releaseConfirmation = deferred();
  try {
    const headers = await mutationHeaders(phone, new URL(baseURL!).origin);
    const paired = await phone.post('/api/pair', { headers, data: { sessionId: id, secret: new URLSearchParams(invitation.hash.slice(1)).get('invite') } });
    expect(paired.ok()).toBe(true);
    const confirm = page.getByRole('button', { name: 'Les codes correspondent', exact: true });
    await expect(confirm).toBeVisible();
    await page.route(`**/api/sessions/${id}/confirm`, async route => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      confirmationHeld.resolve(); await releaseConfirmation.promise;
      await route.fulfill({ response });
    });
    await confirm.click(); await confirmationHeld.promise;
    await expect(page.getByTestId('session-state')).toHaveText('Prise de photos autorisée');
    await expect(page.locator('.session-main')).toHaveAttribute('aria-busy', 'true');
    await uploadSyntheticPhoto(page, phone, id, headers);
    const finalized = await phone.post(`/api/sessions/${id}/finalize`, { headers, data: {} });
    expect(finalized.ok()).toBe(true);
    await expect(page.getByTestId('session-state')).toHaveText('Dossier finalisé');
    releaseConfirmation.resolve();
    // Busy ends only after the stale mutation response has been consumed by the application.
    await expect(page.locator('.session-main')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('session-state')).toHaveText('Dossier finalisé');
    await page.getByRole('button', { name: 'Créer un autre dossier', exact: true }).click();
    await expect(recentRow(page, value)).toHaveCount(1);
    await expect(recentRow(page, value)).toContainText('Dossier finalisé');
  } finally { releaseConfirmation.resolve(); await phone.dispose(); }
});

test('a delayed dossier selection cannot replace a newer selection', async ({ page }) => {
  const first = reference('FIRST'); const second = reference('SECOND');
  await page.goto('/'); const firstId = await createSession(page, first);
  await page.getByRole('button', { name: 'Créer un autre dossier', exact: true }).click();
  await createSession(page, second);
  await page.getByRole('button', { name: 'Créer un autre dossier', exact: true }).click();
  const held = deferred(); const release = deferred();
  await page.route(`**/api/sessions/${firstId}`, async route => {
    const response = await route.fetch(); held.resolve(); await release.promise;
    await route.fulfill({ response });
  });
  const firstResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/sessions/${firstId}`);
  try {
    await recentRow(page, first).click(); await held.promise;
    await recentRow(page, second).click();
    await expect(page.getByRole('heading', { name: second, exact: true })).toBeVisible();
    release.resolve(); await (await firstResponse).finished();
    // Cross a rendering opportunity after the response body, rather than using a timed sleep.
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('heading', { name: second, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: first, exact: true })).toHaveCount(0);
  } finally { release.resolve(); }
});
