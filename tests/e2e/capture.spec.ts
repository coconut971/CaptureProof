import { expect, test, devices, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import { installCameraFixture } from './camera-fixture';

async function mobileContext(browser: Browser, baseURL: string): Promise<BrowserContext> {
  return browser.newContext({ ...devices['iPhone 13'], baseURL });
}

async function createDesktopSession(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Référence métier').fill(`E2E-${crypto.randomUUID().slice(0, 8)}`);
  await page.getByRole('button', { name: 'Créer une session', exact: true }).click();
  await page.getByText('Accès manuel à l’invitation', { exact: true }).click();
  await expect(page.getByTestId('invitation-link')).toBeVisible();
}

async function startDirectMobile(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Commencer la capture mobile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Activer la caméra', exact: true })).toBeVisible();
}

async function expectCompletedPhone(phone: Page): Promise<void> {
  await expect(phone.getByTestId('capture-complete')).toBeVisible();
  await expect(phone.getByText('Photos envoyées. Vous pouvez revenir sur votre ordinateur.', { exact: true })).toBeVisible();
  await expect(phone.getByText('Vous pouvez fermer cet onglet.', { exact: true })).toBeVisible();
  await expect(phone.locator('capture-proof, video, img, input[type="file"], nav, .gallery, .photos')).toHaveCount(0);
  await expect(phone.getByTestId('received-photo')).toHaveCount(0);
  await expect(phone.getByRole('button', { name: 'Activer la caméra', exact: true })).toHaveCount(0);
  await expect(phone.getByRole('button', { name: 'Prendre une photo', exact: true })).toHaveCount(0);
  await expect(phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true })).toHaveCount(0);
  await expectCameraStopped(phone);
  await expectNoSessionPolling(phone);
}

async function expectCameraStopped(phone: Page): Promise<void> {
  const camera = await phone.evaluate(() => ({
    created: window.captureProofCameraTest.createdTracks,
    allStopped: window.captureProofCameraTest.createdTracks === window.captureProofCameraTest.stoppedTracks
      && window.captureProofCameraTest.tracks.every(track => track.readyState === 'ended'),
    stopCalls: window.captureProofCameraTest.stopCalls,
  }));
  expect(camera.created).toBeGreaterThan(0);
  expect(camera.allStopped).toBe(true);
  expect(camera.stopCalls).toBeGreaterThan(0);
}

async function expectNoSessionPolling(phone: Page): Promise<void> {
  // Allow in-flight teardown to settle, then cross the product's eight-second poll interval.
  await phone.waitForTimeout(300);
  let sessionReads = 0;
  const countRead = (request: Request): void => {
    if (request.method() === 'GET' && /^\/api\/sessions\/[a-f0-9-]+$/.test(new URL(request.url()).pathname)) sessionReads++;
  };
  phone.on('request', countRead);
  try {
    await phone.waitForTimeout(9_000);
    expect(sessionReads).toBe(0);
  } finally {
    phone.off('request', countRead);
  }
}

test('desktop creates a QR session without ever requesting camera or offering import', async ({ page }) => {
  await installCameraFixture(page);
  await createDesktopSession(page);
  await expect(page.getByAltText('QR code d’appairage')).toBeVisible();
  const invitation = await page.getByTestId('invitation-link').getAttribute('href');
  expect(new URL(invitation!).protocol).toBe('https:');
  expect(/^#invite=.{40,}$/.test(new URL(invitation!).hash)).toBe(true);
  expect(await page.evaluate(() => window.captureProofCameraTest.calls)).toHaveLength(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activer la caméra', exact: true })).toHaveCount(0);
});

test('separate desktop and phone contexts pair, confirm, capture and finalize', async ({ browser, page, baseURL }) => {
  await installCameraFixture(page);
  await createDesktopSession(page);
  const invitation = new URL((await page.getByTestId('invitation-link').getAttribute('href'))!);
  const mobile = await mobileContext(browser, baseURL!);
  let releaseCompletionNavigation: (() => void) | undefined;
  try {
    const phone = await mobile.newPage();
    const cameraObserver = await installCameraFixture(phone);
    let fragmentRemovedBeforePair = false;
    await phone.route('**/api/pair', async (route) => {
      fragmentRemovedBeforePair = await phone.evaluate(() => location.hash.length === 0);
      await route.continue();
    });
    await phone.goto(invitation.pathname + invitation.hash);
    await expect.poll(() => phone.evaluate(() => location.hash)).toBe('');
    await expect(page.getByRole('button', { name: 'Les codes correspondent', exact: true })).toBeVisible();
    expect(fragmentRemovedBeforePair).toBe(true);
    await expect(phone.getByTestId('confirmation-code')).toHaveText((await page.getByTestId('confirmation-code').textContent())!);
    expect(await phone.evaluate(() => window.captureProofCameraTest.calls)).toHaveLength(0);
    await page.getByRole('button', { name: 'Les codes correspondent', exact: true }).click();
    await expect(phone.getByRole('button', { name: 'Activer la caméra', exact: true })).toBeVisible();
    await expect(phone.locator('input[type="file"]')).toHaveCount(0);
    await phone.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
    await expect(phone.getByRole('button', { name: 'Prendre une photo', exact: true })).toBeEnabled();
    await phone.getByRole('button', { name: 'Prendre une photo', exact: true }).click();
    await expect(page.getByTestId('received-photo')).toHaveCount(1);
    await expect.poll(() => cameraObserver.snapshot().createdTracks).toBe(1);
    await expect(phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true })).toBeEnabled();
    let completionNavigationStarted = false;
    const completionNavigationReleased = new Promise<void>(resolve => { releaseCompletionNavigation = resolve; });
    await phone.route('**/capture-complete.html', async (route) => {
      completionNavigationStarted = true;
      await completionNavigationReleased;
      await route.continue();
    });
    await phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true }).click({ noWaitAfter: true });
    await expect.poll(() => completionNavigationStarted).toBe(true);
    expect(new URL(phone.url()).pathname).toBe(invitation.pathname);
    // The old capture document must already be inert while the completion HTML is unavailable.
    await expect.poll(() => cameraObserver.snapshot().stoppedTracks).toBe(1);
    expect(cameraObserver.snapshot().stopCalls).toBeGreaterThan(0);
    expect(cameraObserver.snapshot().documentPath).toBe(invitation.pathname);
    await expectNoSessionPolling(phone);
    releaseCompletionNavigation?.();
    await expectCompletedPhone(phone);
    await expect(page.getByTestId('session-state')).toContainText(/finalis|termin/i);
    expect(await page.evaluate(() => window.captureProofCameraTest.calls)).toHaveLength(0);
    const calls = await phone.evaluate(() => window.captureProofCameraTest.calls);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.audio).toBe(false);
  } finally {
    releaseCompletionNavigation?.();
    await mobile.close();
  }
});

test('camera denial gives an explanation and supports retry without a gallery import', async ({ browser, baseURL }) => {
  const mobile = await mobileContext(browser, baseURL!);
  try {
    const phone = await mobile.newPage();
    await installCameraFixture(phone, true);
    await startDirectMobile(phone);
    await phone.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
    await expect(phone.getByText(/caméra.*(refus|autorisa)|permission.*refus/i)).toBeVisible();
    await expect(phone.locator('input[type="file"]')).toHaveCount(0);
    await phone.evaluate(() => { window.captureProofCameraTest.denied = false; });
    await phone.getByRole('button', { name: 'Relancer la caméra', exact: true }).click();
    await expect(phone.getByRole('button', { name: 'Prendre une photo', exact: true })).toBeEnabled();
  } finally {
    await mobile.close();
  }
});

test('lost upload response retries the same authorized bytes without a duplicate', async ({ browser, baseURL }) => {
  const mobile = await mobileContext(browser, baseURL!);
  try {
    const phone = await mobile.newPage();
    await installCameraFixture(phone);
    await startDirectMobile(phone);
    let lostResponse = false;
    const uploadPaths: string[] = [];
    // Simulate loss of both the PUT response and recovery reads until the explicit retry.
    await phone.route('**/api/sessions/*', async (route) => {
      if (route.request().method() === 'GET' && lostResponse && uploadPaths.length < 2) {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    await phone.route('**/api/sessions/*/uploads/*', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      uploadPaths.push(new URL(route.request().url()).pathname);
      if (!lostResponse) {
        lostResponse = true;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });
    await phone.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
    await phone.getByRole('button', { name: 'Prendre une photo', exact: true }).click();
    await expect(phone.getByRole('button', { name: 'Réessayer l’envoi', exact: true })).toBeVisible();
    const pendingHint = phone.getByText('Les photos en attente restent en mémoire sur cette page. Gardez-la ouverte, sans la recharger, jusqu’à confirmation de leur réception.', { exact: true });
    await expect(pendingHint).toBeVisible();
    await expect(phone.getByText(/Connexion au serveur interrompue\. La photo reste en mémoire/)).toBeVisible();
    await phone.getByRole('button', { name: 'Réessayer l’envoi', exact: true }).click();
    await expect(phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true })).toBeEnabled();
    await expect(pendingHint).toBeHidden();
    expect(uploadPaths).toHaveLength(2);
    expect(uploadPaths[0]).toBe(uploadPaths[1]);
    await phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true }).click();
    await expectCompletedPhone(phone);
  } finally {
    await mobile.close();
  }
});

test('failed finalization keeps capture recovery available until server confirmation', async ({ browser, baseURL }) => {
  const mobile = await mobileContext(browser, baseURL!);
  try {
    const phone = await mobile.newPage();
    await installCameraFixture(phone);
    await startDirectMobile(phone);
    await phone.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
    await phone.getByRole('button', { name: 'Prendre une photo', exact: true }).click();
    const finish = phone.getByRole('button', { name: 'Terminer et recevoir le reçu', exact: true });
    await expect(finish).toBeEnabled();
    let finalizationAttempts = 0;
    await phone.route('**/api/sessions/*/finalize', async (route) => {
      finalizationAttempts++;
      if (finalizationAttempts === 1) await route.abort('failed');
      else await route.continue();
    });
    await finish.click();
    await expect(phone.getByRole('alert')).toContainText(/failed|fetch|réseau|connexion|requête/i);
    await expect(phone.getByTestId('capture-complete')).toHaveCount(0);
    await expect(phone.locator('capture-proof video')).toHaveCount(1);
    await expect(phone.getByRole('button', { name: 'Supprimer / reprendre', exact: true })).toBeVisible();
    await expect(finish).toBeEnabled();
    expect(await phone.evaluate(() => window.captureProofCameraTest.tracks.some(track => track.readyState === 'live'))).toBe(true);
    await finish.click();
    await expectCompletedPhone(phone);
    expect(finalizationAttempts).toBe(2);
  } finally {
    await mobile.close();
  }
});

test('capture-only completion retains the local photo download', async ({ browser, baseURL }) => {
  const mobile = await mobileContext(browser, baseURL!);
  try {
    const phone = await mobile.newPage();
    await installCameraFixture(phone);
    await phone.goto('/standalone');
    await phone.getByRole('button', { name: 'Activer la caméra', exact: true }).click();
    await phone.getByRole('button', { name: 'Prendre une photo', exact: true }).click();
    const finish = phone.getByRole('button', { name: 'Terminer la capture seule', exact: true });
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(phone.getByTestId('capture-complete')).toHaveCount(0);
    await expect(phone.getByText('Aucun envoi serveur, aucune signature. Téléchargez les fichiers avant de quitter cette page.', { exact: true })).toBeVisible();
    const downloadEvent = phone.waitForEvent('download');
    await phone.getByRole('button', { name: 'Télécharger la photo', exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/\.jpg$/);
    expect(await download.failure()).toBeNull();
    expect(await phone.evaluate(() => window.captureProofCameraTest.tracks.every(track => track.readyState === 'ended'))).toBe(true);
  } finally {
    await mobile.close();
  }
});
