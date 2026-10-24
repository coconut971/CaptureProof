import { expect, test } from '@playwright/test';
import { verifyReceipt } from '@captureproof/receipt-verifier';

test('real .NET ES256 receipt verifies independently in TypeScript with explicit trust', async ({ page, request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const bootstrap = await request.get('/api/bootstrap');
  expect(bootstrap.ok()).toBe(true);
  const { csrfToken } = await bootstrap.json() as { csrfToken: string };
  const headers = { Origin: origin, 'X-CSRF-TOKEN': csrfToken };
  const businessReference = `INTEROP-${crypto.randomUUID().slice(0, 8)}`;
  const created = await request.post('/api/sessions', {
    headers,
    data: { category: 'vinyl', businessReference, direct: true },
  });
  expect(created.ok()).toBe(true);
  const session = await created.json() as { id: string };
  const uploadId = crypto.randomUUID();
  const reserved = await request.post(`/api/sessions/${session.id}/uploads`, { headers, data: { uploadId } });
  expect(reserved.ok()).toBe(true);
  const reservation = await reserved.json() as { authorization: string };
  await page.goto('/');
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#33779a';
    context.fillRect(0, 0, 32, 32);
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]!;
  });
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  const uploaded = await request.put(`/api/sessions/${session.id}/uploads/${uploadId}`, {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Upload-Authorization': reservation.authorization },
    data: Buffer.from(bytes),
  });
  expect(uploaded.ok()).toBe(true);
  const photo = await uploaded.json() as { id: string };
  const finalized = await request.post(`/api/sessions/${session.id}/finalize`, { headers, data: {} });
  expect(finalized.ok()).toBe(true);
  const { jws } = await finalized.json() as { jws: string };
  const publicKeyResponse = await request.get('/api/keys');
  const { keys } = await publicKeyResponse.json() as { keys: JsonWebKey[] };
  const files = [{ name: `${photo.id}.jpg`, bytes }];
  const expectedContext = { integrationSpace: 'demo', businessReference };

  // The test explicitly supplies a trusted key set. The verifier performs no API calls.
  const verified = await verifyReceipt(jws, files, keys, expectedContext);
  expect(verified.valid).toBe(true);
  const alteredBytes = bytes.slice();
  alteredBytes[alteredBytes.length - 1] = alteredBytes[alteredBytes.length - 1]! ^ 1;
  expect((await verifyReceipt(jws, [{ ...files[0]!, bytes: alteredBytes }], keys, expectedContext)).valid).toBe(false);
  expect((await verifyReceipt(jws, files, [], expectedContext)).valid).toBe(false);
  expect((await verifyReceipt(jws, files, keys, { ...expectedContext, businessReference: 'OTHER-REFERENCE' })).valid).toBe(false);
  const parts = jws.split('.');
  const signature = parts[2]!;
  parts[2] = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
  expect((await verifyReceipt(parts.join('.'), files, keys, expectedContext)).valid).toBe(false);
});
