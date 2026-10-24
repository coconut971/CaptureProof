import { CaptureController, isMobileBrowser, registerCaptureElement, type CaptureProofElement } from '@captureproof/capture-web';

const host = document.querySelector('#capture')!;
if (!isMobileBrowser()) {
  host.textContent = 'Ouvrez cet exemple dans un navigateur mobile HTTPS. Aucune caméra ne sera demandée sur ordinateur.';
} else {
  registerCaptureElement();
  const controller = new CaptureController({
    mode: 'capture-only',
    policy: { minPhotos: 1, maxPhotos: 3, maxBytesPerPhoto: 8 * 1024 * 1024, sessionTtlSeconds: 1800 },
  });
  const element = document.createElement('capture-proof') as CaptureProofElement;
  element.controller = controller;
  element.addEventListener('capturecomplete', event => {
    const detail = (event as CustomEvent<{ photos: { id: string; blob: Blob }[] }>).detail;
    const downloads = document.querySelector('#downloads')!;
    for (const photo of detail.photos) {
      const url = URL.createObjectURL(photo.blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${photo.id}.jpg`; link.textContent = 'Télécharger la photo originale';
      downloads.append(link, document.createElement('br'));
      window.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
    }
  });
  host.append(element);
  window.addEventListener('pagehide', () => controller.dispose(), { once: true });
}
