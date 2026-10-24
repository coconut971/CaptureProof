import type { Page } from '@playwright/test';

type CameraTestState = {
  denied: boolean;
  calls: MediaStreamConstraints[];
  tracks: MediaStreamTrack[];
  stopCalls: number;
  createdTracks: number;
  stoppedTracks: number;
};

type CameraMetrics = Pick<CameraTestState, 'stopCalls' | 'createdTracks' | 'stoppedTracks'> & { documentPath: string };
type CameraObserver = { snapshot(): CameraMetrics };

declare global {
  interface Window {
    captureProofCameraTest: CameraTestState;
    captureProofCameraSnapshot(metrics: CameraMetrics): Promise<void>;
  }
}

/** Synthetic media is confined to browser tests and never shipped with the capture package. */
export async function installCameraFixture(page: Page, denied = false): Promise<CameraObserver> {
  let metrics: CameraMetrics = { stopCalls: 0, createdTracks: 0, stoppedTracks: 0, documentPath: '' };
  await page.exposeFunction('captureProofCameraSnapshot', (snapshot: CameraMetrics) => { metrics = snapshot; });
  await page.addInitScript(({ initiallyDenied }) => {
    // Keep only synthetic test counters across the completion page's document navigation.
    const storageKey = 'captureproof-test-camera';
    const previous = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null') as Pick<CameraTestState, 'calls' | 'stopCalls' | 'createdTracks' | 'stoppedTracks'> | null;
    window.captureProofCameraTest = {
      denied: initiallyDenied, tracks: [], calls: previous?.calls ?? [],
      stopCalls: previous?.stopCalls ?? 0, createdTracks: previous?.createdTracks ?? 0,
      stoppedTracks: previous?.stoppedTracks ?? 0,
    };
    const persist = (): void => {
      const { calls, stopCalls, createdTracks, stoppedTracks } = window.captureProofCameraTest;
      sessionStorage.setItem(storageKey, JSON.stringify({ calls, stopCalls, createdTracks, stoppedTracks }));
      // Notify the test runner before navigation; normal page evaluation waits for navigation to finish.
      void window.captureProofCameraSnapshot({ stopCalls, createdTracks, stoppedTracks, documentPath: location.pathname }).catch(() => {});
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async (constraints: MediaStreamConstraints) => {
          window.captureProofCameraTest.calls.push(constraints);
          persist();
          if (window.captureProofCameraTest.denied) {
            throw new DOMException('Permission refusée pour ce test.', 'NotAllowedError');
          }
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas indisponible dans le navigateur de test.');
          const draw = (): void => {
            context.fillStyle = '#25425e';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#f2cc7c';
            context.fillRect(180, 100, 280, 280);
          };
          draw();
          const stream = canvas.captureStream(10);
          const timer = window.setInterval(draw, 100);
          for (const track of stream.getTracks()) {
            window.captureProofCameraTest.tracks.push(track);
            window.captureProofCameraTest.createdTracks++;
            persist();
            const stop = track.stop.bind(track);
            let stopped = false;
            track.stop = () => {
              window.captureProofCameraTest.stopCalls++;
              window.clearInterval(timer);
              stop();
              if (!stopped && track.readyState === 'ended') {
                stopped = true;
                window.captureProofCameraTest.stoppedTracks++;
              }
              persist();
            };
          }
          return stream;
        },
      },
    });
  }, { initiallyDenied: denied });
  return { snapshot: () => metrics };
}
