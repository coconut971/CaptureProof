import { CaptureController } from './controller.js';

const styles = `:host{display:block;font:16px/1.5 system-ui;color:#182b28}*{box-sizing:border-box}button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid #b5cbc3;padding:12px 18px;min-height:48px;color:#173a30;background:white}button:disabled{opacity:.5;cursor:not-allowed}.target-label{display:grid;gap:6px;font-size:14px;font-weight:600}.target-select{font:inherit;min-height:48px;border:1px solid #b5cbc3;border-radius:9px;padding:10px 12px;background:white;color:#173a30;max-width:100%}.target-select:focus-visible{outline:3px solid #dca64b;outline-offset:3px}.primary{background:#195b47;color:white;border-color:#195b47}.camera{position:relative;background:#10241f;border-radius:16px;overflow:hidden;aspect-ratio:3/4;max-height:62vh;margin:16px 0}.camera video{width:100%;height:100%;object-fit:contain}.placeholder{position:absolute;inset:0;display:grid;place-content:center;text-align:center;color:#e6ede9;padding:20px;pointer-events:none}.toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.toolbar button{flex:1}.hint{color:#536660;font-size:14px}.error{background:#fff1ee;color:#873426;padding:12px;border-radius:10px}.photos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.photo{border:1px solid #d6e2dc;border-radius:10px;overflow:hidden;background:white;min-width:0}.photo img{width:100%;height:110px;object-fit:cover}.photo div{padding:8px;font-size:12px}.photo button{padding:6px;font-size:12px;width:100%;margin-top:5px;min-height:40px}.photo progress{width:100%}.success{padding:20px;background:#e6f2eb;border-radius:12px}.counter{font-weight:650}.muted{font-size:13px;color:#536660}`;

/** Thin view over CaptureController. Assign controller before inserting the element. */
export class CaptureProofElement extends HTMLElement {
  private current?: CaptureController;
  private readonly root = this.attachShadow({ mode: 'open' });
  private video!: HTMLVideoElement;
  private cameraHint!: HTMLDivElement;
  private errorBox!: HTMLParagraphElement;
  private photos!: HTMLDivElement;
  private pendingHint!: HTMLParagraphElement;
  private counter!: HTMLParagraphElement;
  private targetSelect!: HTMLSelectElement;
  private targetHint!: HTMLParagraphElement;
  private targetCount?: number;
  private targetBounds = '';
  private start!: HTMLButtonElement;
  private shutter!: HTMLButtonElement;
  private finish!: HTMLButtonElement;
  private status!: HTMLDivElement;
  private readonly changed = (): void => this.render();
  private readonly completed = (event: Event): void => {
    this.dispatchEvent(new CustomEvent('capturecomplete', { detail: (event as CustomEvent).detail, bubbles: true, composed: true }));
  };

  set controller(controller: CaptureController | undefined) {
    if (this.current !== controller) { this.targetCount = undefined; this.targetBounds = ''; }
    this.current?.removeEventListener('change', this.changed);
    this.current?.removeEventListener('complete', this.completed);
    this.current = controller;
    this.current?.addEventListener('change', this.changed);
    this.current?.addEventListener('complete', this.completed);
    if (this.isConnected) this.render();
  }
  get controller(): CaptureController | undefined { return this.current; }

  connectedCallback(): void {
    if (!this.video) {
      this.root.innerHTML = `<style>${styles}</style><label class="target-label">Objectif de photos<select class="target-select" aria-describedby="target-hint"></select></label><p id="target-hint" class="hint"></p><p class="counter" aria-live="polite"></p><div class="camera"><video muted playsinline aria-label="Aperçu de la caméra"></video><div class="placeholder">Caméra arrêtée</div></div><div class="toolbar"><button class="start">Activer la caméra</button><button class="shutter primary">Prendre une photo</button></div><p class="error" role="alert" hidden></p><div class="photos" aria-live="polite"></div><p class="muted pending-hint" role="status" hidden>Les photos en attente restent en mémoire sur cette page. Gardez-la ouverte, sans la recharger, jusqu’à confirmation de leur réception.</p><button class="finish primary">Terminer et recevoir le reçu</button><div class="status" role="status"></div><p class="muted">Aucun import de galerie. Le reçu lie les fichiers acceptés à leur contexte ; il ne certifie pas l’origine physique de la caméra.</p>`;
      this.video = this.root.querySelector('video')!;
      this.cameraHint = this.root.querySelector('.placeholder')!;
      this.errorBox = this.root.querySelector('.error')!;
      this.photos = this.root.querySelector('.photos')!;
      this.pendingHint = this.root.querySelector('.pending-hint')!;
      this.counter = this.root.querySelector('.counter')!;
      this.targetSelect = this.root.querySelector('.target-select')!;
      this.targetHint = this.root.querySelector('#target-hint')!;
      this.start = this.root.querySelector('.start')!;
      this.shutter = this.root.querySelector('.shutter')!;
      this.finish = this.root.querySelector('.finish')!;
      this.status = this.root.querySelector('.status')!;
      this.start.addEventListener('click', () => void this.current?.startCamera(this.video));
      this.shutter.addEventListener('click', () => void this.current?.capture());
      this.finish.addEventListener('click', () => void this.current?.finalize());
      this.targetSelect.addEventListener('change', () => { this.targetCount = Number(this.targetSelect.value); this.render(); });
    }
    this.render();
  }

  disconnectedCallback(): void { this.current?.stopCamera(); }

  private render(): void {
    if (!this.video || !this.current) return;
    const snapshot = this.current.snapshot;
    const { minPhotos, maxPhotos } = snapshot.policy;
    const bounds = `${minPhotos}:${maxPhotos}`;
    this.targetCount = Math.max(minPhotos, Math.min(maxPhotos, this.targetCount ?? minPhotos));
    if (this.targetBounds !== bounds) {
      this.targetBounds = bounds;
      this.targetSelect.replaceChildren(...Array.from({ length: maxPhotos - minPhotos + 1 }, (_, index) => {
        const option = document.createElement('option'); const count = minPhotos + index;
        option.value = String(count); option.textContent = `${count} photo${count > 1 ? 's' : ''}`; return option;
      }));
    }
    this.targetSelect.value = String(this.targetCount);
    this.targetSelect.disabled = minPhotos === maxPhotos || snapshot.sessionState !== 'Capturing';
    this.targetHint.textContent = minPhotos === maxPhotos ? `La règle impose exactement ${minPhotos} photo${minPhotos > 1 ? 's' : ''}.`
      : `Préférence personnelle : les limites restent de ${minPhotos} à ${maxPhotos} photos. Vous pouvez terminer dès le minimum atteint et tous les envois confirmés.`;
    const confirmedCount = snapshot.photos.filter(photo => photo.status === 'confirmed').length;
    this.counter.textContent = `${confirmedCount} photo${confirmedCount > 1 ? 's' : ''} confirmée${confirmedCount > 1 ? 's' : ''} · objectif ${this.targetCount} · maximum ${maxPhotos}`;
    this.cameraHint.hidden = snapshot.camera === 'ready';
    this.cameraHint.textContent = snapshot.camera === 'starting' ? 'Autorisez la caméra dans votre navigateur' : 'Caméra arrêtée';
    this.start.hidden = snapshot.camera === 'ready';
    this.start.disabled = snapshot.camera === 'starting' || snapshot.sessionState !== 'Capturing';
    this.start.textContent = snapshot.camera === 'paused' || snapshot.camera === 'error' ? 'Relancer la caméra' : 'Activer la caméra';
    this.shutter.disabled = !snapshot.canCapture;
    this.finish.disabled = !snapshot.canFinalize;
    this.finish.textContent = snapshot.mode === 'capture-only' ? 'Terminer la capture seule' : 'Terminer et recevoir le reçu';
    this.errorBox.hidden = !snapshot.error; this.errorBox.textContent = snapshot.error ?? '';
    this.pendingHint.hidden = snapshot.mode !== 'server-receipt' || snapshot.sessionState !== 'Capturing'
      || !snapshot.photos.some(photo => ['reserving', 'uploading', 'failed'].includes(photo.status));
    this.photos.replaceChildren(...snapshot.photos.map(photo => {
      const card = document.createElement('article'); card.className = 'photo';
      const image = document.createElement('img'); image.src = photo.previewUrl; image.alt = 'Photo de la session';
      const details = document.createElement('div');
      const label = document.createElement('span'); label.textContent = photo.error ?? ({ reserving: 'Préparation…', uploading: 'Envoi en cours…', confirmed: snapshot.mode === 'capture-only' ? 'Conservée sur cet appareil' : 'Reçue par le serveur', failed: 'Envoi interrompu', deleting: 'Suppression…' })[photo.status];
      details.append(label);
      if (photo.status === 'uploading') { const progress = document.createElement('progress'); progress.max = 1; progress.value = photo.progress; progress.setAttribute('aria-label', 'Progression de l’envoi'); details.append(progress); }
      if (snapshot.sessionState === 'Capturing' && ['confirmed', 'failed'].includes(photo.status)) {
        const button = document.createElement('button'); button.textContent = photo.status === 'failed' ? 'Réessayer l’envoi' : 'Supprimer / reprendre';
        button.onclick = () => void (photo.status === 'failed' ? this.current?.retry(photo.id) : this.current?.remove(photo.id));
        details.append(button);
      }
      card.append(image, details); return card;
    }));
    const finalized = snapshot.sessionState === 'Finalized';
    this.status.className = finalized ? 'status success' : 'status';
    this.status.textContent = finalized ? (snapshot.mode === 'server-receipt' ? 'Photos envoyées. Vous pouvez revenir sur votre ordinateur.' : 'Capture seule terminée sur cet appareil. Aucun reçu serveur signé.') : '';
  }
}

export function registerCaptureElement(): void {
  if (!customElements.get('capture-proof')) customElements.define('capture-proof', CaptureProofElement);
}
