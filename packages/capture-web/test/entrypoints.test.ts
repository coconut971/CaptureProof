// @vitest-environment jsdom
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('public capture entry points', () => {
  it('imports the built headless package in plain Node without DOM globals', () => {
    // A separate Node process cannot inherit jsdom or an HTMLElement shim from this test.
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', `
      import assert from 'node:assert/strict';
      assert.equal(typeof globalThis.HTMLElement, 'undefined');
      assert.equal(typeof globalThis.document, 'undefined');
      const capture = await import('@captureproof/capture-web/headless');
      assert.equal('CaptureProofElement' in capture, false);
      assert.equal('registerCaptureElement' in capture, false);
      const controller = new capture.CaptureController({
        mode: 'capture-only',
        policy: { minPhotos: 1, maxPhotos: 3, maxBytesPerPhoto: 1024, sessionTtlSeconds: 600 },
      });
      assert.equal(controller.snapshot.camera, 'off');
      assert.equal(controller.snapshot.photos.length, 0);
      assert.equal(controller.snapshot.canCapture, false);
      assert.equal(capture.isMobileBrowser({ userAgent: 'Android', maxTouchPoints: 1 }), true);
      controller.dispose();
      assert.equal(typeof globalThis.HTMLElement, 'undefined');
      console.log('headless-import-without-dom');
    `], { encoding: 'utf8' });
    expect(output.trim()).toBe('headless-import-without-dom');
  });

  it('preserves the default browser entry and its Web Component', async () => {
    const browser = await import('../src/index');
    const headless = await import('../src/headless');
    expect(browser.CaptureController).toBe(headless.CaptureController);
    expect(browser.CaptureProofElement.prototype).toBeInstanceOf(HTMLElement);
    browser.registerCaptureElement();
    browser.registerCaptureElement();
    const controller = new browser.CaptureController({
      mode: 'capture-only',
      policy: { minPhotos: 1, maxPhotos: 3, maxBytesPerPhoto: 1024, sessionTtlSeconds: 600 },
    });
    const element = document.createElement('capture-proof') as InstanceType<typeof browser.CaptureProofElement>;
    try {
      element.controller = controller;
      document.body.append(element);
      expect(customElements.get('capture-proof')).toBe(browser.CaptureProofElement);
      expect(element.shadowRoot?.querySelector('video')).not.toBeNull();
      expect(element.shadowRoot?.querySelector('.start')?.textContent).toBe('Activer la caméra');
    } finally { element.remove(); controller.dispose(); }
  });
});
