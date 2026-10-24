import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { CaptureController, isMobileBrowser, registerCaptureElement, type CaptureProofElement, type CaptureSession } from '@captureproof/capture-web';
import { api, ApiError, createTransport, download } from './api';
import { watchSession } from './live';
import { Verify } from './Verify';
import './style.css';

// Remove invitation secrets synchronously, before bootstrap, networking or React effects.
const initialPath = window.location.pathname;
const invitationSecret = new URLSearchParams(window.location.hash.slice(1)).get('invite');
if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
const mobile = isMobileBrowser();
registerCaptureElement();
let capturePageFinished = false;
const capturePageCleanups = new Set<() => void>();
function finishCapturePage(): void {
  if (capturePageFinished) return;
  capturePageFinished = true;
  for (const cleanup of capturePageCleanups) cleanup();
  capturePageCleanups.clear();
  window.location.replace('/capture-complete.html');
}
function watchCaptureSession(...args: Parameters<typeof watchSession>): () => void {
  const stop = watchSession(...args);
  capturePageCleanups.add(stop);
  return () => { capturePageCleanups.delete(stop); stop(); };
}
const labels: Record<CaptureSession['state'], string> = {
  AwaitingPairing: 'En attente du téléphone', PendingConfirmation: 'Comparer les codes', Capturing: 'Prise de photos autorisée',
  Finalized: 'Dossier finalisé', Cancelled: 'Session annulée', Expired: 'Session expirée',
};
const terminalStates = new Set<CaptureSession['state']>(['Finalized', 'Cancelled', 'Expired']);
const failure = (reason: unknown): string => reason instanceof Error ? reason.message : 'La requête a échoué. Réessayez.';

function Shell({ children }: { children: ReactNode }): React.JSX.Element {
  return <><header className="header"><a className="brand" href="/" aria-label="CaptureProof accueil"><span className="brand-icon" aria-hidden="true">C<span>·</span></span>CaptureProof<span className="demo-tag">DÉMO</span></a><nav aria-label="Navigation principale"><a href="/" className={!initialPath.startsWith('/verify') ? 'active' : ''}>Dossier photo</a><a href="/verify" className={initialPath.startsWith('/verify') ? 'active' : ''}>Vérifier un reçu</a></nav></header><main>{children}</main><footer>Prototype de référence · Conservation temporaire de 24 h par défaut.<br />Le reçu lie les octets acceptés et le contexte déclaré. Il ne prouve ni l’authenticité de l’objet, ni l’absence d’IA, ni l’origine physique de la caméra.</footer></>;
}

function CaptureView({ session, standalone = false }: { session?: CaptureSession; standalone?: boolean }): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<CaptureController>(null);
  const [localPhotos, setLocalPhotos] = useState<{ id: string; blob: Blob }[]>([]);
  const sessionId = session?.id;
  useEffect(() => {
    if (!host.current) return;
    const capture = new CaptureController(standalone ? { mode: 'capture-only', policy: { minPhotos: 1, maxPhotos: 3, maxBytesPerPhoto: 8 * 1024 * 1024, sessionTtlSeconds: 1800 } }
      : { mode: 'server-receipt', policy: session!.policy, session: session!, transport: createTransport(sessionId!) });
    controller.current = capture;
    const release = (): void => capture.dispose();
    if (!standalone) capturePageCleanups.add(release);
    const element = document.createElement('capture-proof') as CaptureProofElement;
    element.controller = capture;
    element.addEventListener('capturecomplete', event => {
      if (standalone) setLocalPhotos((event as CustomEvent<{ photos: { id: string; blob: Blob }[] }>).detail.photos);
      else { capture.dispose(); finishCapturePage(); }
    });
    host.current.replaceChildren(element);
    return () => { capturePageCleanups.delete(release); element.remove(); capture.dispose(); controller.current = null; };
    // A session retains its controller while authoritative state is synchronized below.
  }, [sessionId, standalone]);
  useEffect(() => { if (session) controller.current?.sync(session); }, [session]);
  return <><div ref={host} />{standalone && localPhotos.length > 0 && <div className="stack"><p>Aucun envoi serveur, aucune signature. Téléchargez les fichiers avant de quitter cette page.</p>{localPhotos.map(photo => <button key={photo.id} onClick={() => download(`${photo.id}.jpg`, photo.blob, 'image/jpeg')}>Télécharger la photo</button>)}</div>}</>;
}

function PhonePage({ id }: { id: string }): React.JSX.Element | null {
  const [session, setSession] = useState<CaptureSession>();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connexion au dossier…');
  const [loading, setLoading] = useState(true);
  const pairing = useRef<Promise<CaptureSession>>(null);
  const receiveSession = (next: CaptureSession): void => {
    if (capturePageFinished) return;
    if (mobile && next.state === 'Finalized') { finishCapturePage(); return; }
    setSession(next);
  };
  async function retryOpening(): Promise<void> {
    setLoading(true); setError('');
    try {
      let next: CaptureSession;
      try { next = await api<CaptureSession>(`/api/sessions/${encodeURIComponent(id)}`); }
      catch (reason) {
        if (!invitationSecret) throw reason;
        next = await api<CaptureSession>('/api/pair', { sessionId: id, secret: invitationSecret });
      }
      receiveSession(next);
    } catch (reason) { setError(failure(reason)); }
    finally { setLoading(false); }
  }
  const reload = async (): Promise<void> => {
    if (capturePageFinished) return;
    try { const next = await api<CaptureSession>(`/api/sessions/${encodeURIComponent(id)}`); receiveSession(next); }
    catch (reason) {
      if (capturePageFinished) return;
      if (reason instanceof ApiError && [401, 403, 404].includes(reason.status)) { setSession(undefined); setError('Cette autorisation de capture n’est plus disponible. Demandez une nouvelle invitation sur l’ordinateur.'); }
      else throw reason;
    }
  };
  useEffect(() => {
    if (!mobile) { setLoading(false); return; }
    let alive = true;
    pairing.current ??= invitationSecret ? api<CaptureSession>('/api/pair', { sessionId: id, secret: invitationSecret }) : api<CaptureSession>(`/api/sessions/${encodeURIComponent(id)}`);
    void pairing.current.then(next => { if (alive) receiveSession(next); }).catch(reason => { if (alive) setError(failure(reason)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    if (!session) return;
    if (mobile && session.state === 'Finalized') { finishCapturePage(); return; }
    return watchCaptureSession(id, reload, setStatus);
  }, [id, Boolean(session), session?.state === 'Finalized']);
  if (!mobile) return <section className="panel narrow"><div className="eyebrow">Capture mobile uniquement</div><h1>Ouvrez cette invitation sur votre téléphone</h1><p>Le navigateur ordinateur sert à suivre le dossier. La caméra n’y est jamais proposée.</p><a className="button" href="/">Revenir aux dossiers</a></section>;
  if (session?.state === 'Finalized') return null;
  return <section className="panel phone"><div className="eyebrow">Téléphone · dépôt autorisé</div><h1>{session?.context.businessReference ?? 'Votre dossier photo'}</h1><p className="connection"><span className="live-dot" />{status}</p>
    {loading && <p role="status">Ouverture de la session…</p>}
    {error && <><p role="alert" className="error">{error}</p>{!session && <button disabled={loading} onClick={() => void retryOpening()}>Réessayer l’ouverture</button>}</>}
    {session && <><Status session={session} />{session.state === 'PendingConfirmation' && <div className="pair-code"><p>Comparez ce code sur l’ordinateur</p><strong data-testid="confirmation-code">{session.confirmationCode}</strong><p>Attendez sa confirmation avant d’activer la caméra.</p></div>}
      {session.state === 'AwaitingPairing' && <p>Cette invitation n’est plus active. Demandez un nouveau QR code sur l’ordinateur.</p>}
      {session.state === 'Capturing' && <CaptureView session={session} />}
      {['Cancelled', 'Expired'].includes(session.state) && <p>Cette session est fermée. Démarrez un nouveau dossier pour reprendre.</p>}
    </>}
  </section>;
}

function Status({ session }: { session: CaptureSession }): React.JSX.Element {
  return <div className={`status-pill state-${session.state.toLowerCase()}`} data-testid="session-state"><span />{labels[session.state]}</div>;
}

function Gallery({ session }: { session: CaptureSession }): React.JSX.Element {
  return <div className="gallery" aria-live="polite">{session.photos.length ? session.photos.map((photo, index) => <article className="received-photo" key={photo.id} data-testid="received-photo"><img src={photo.url} alt={`Photo reçue ${index + 1}`} /><div><strong>Photo {index + 1}</strong><span>Reçue par le serveur</span>{session.state === 'Finalized' && <a href={photo.url} download={`${photo.id}.jpg`}>Télécharger l’original</a>}</div></article>) : <div className="gallery-empty"><span className="photo-outline" aria-hidden="true">▧</span><strong>Les photos apparaîtront ici</strong><span>Après leur réception par le serveur.</span></div>}</div>;
}

function Home(): React.JSX.Element | null {
  const [session, setSession] = useState<CaptureSession>();
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [reference, setReference] = useState('DEMO-001');
  const [invitation, setInvitation] = useState<{ url: string; expiresAt: string }>();
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('Connexion au serveur…');
  const selectedSessionId = useRef<string | undefined>(undefined);
  const selectedSnapshot = useRef<CaptureSession | undefined>(undefined);
  const selectionRevision = useRef(0);
  const snapshotRevision = useRef(0);
  const mutationRevision = useRef(0);
  const isCurrentSelection = (revision: number, id?: string): boolean => !capturePageFinished
    && selectionRevision.current === revision && (id === undefined || selectedSessionId.current === id);
  const rememberSession = (next: CaptureSession): void => {
    setSessions(current => {
      const previous = current.find(item => item.id === next.id);
      if (previous && terminalStates.has(previous.state) && previous.state !== next.state) return current;
      return previous ? current.map(item => item.id === next.id ? next : item) : [next, ...current];
    });
  };
  const receiveSession = (next: CaptureSession, revision: number): boolean => {
    if (!isCurrentSelection(revision, next.id)) return false;
    // Terminal server states cannot be reopened by an older mutation response.
    if (selectedSnapshot.current?.id === next.id && terminalStates.has(selectedSnapshot.current.state)
      && selectedSnapshot.current.state !== next.state) return false;
    selectedSnapshot.current = next;
    snapshotRevision.current++;
    rememberSession(next);
    if (mobile && next.state === 'Finalized') { finishCapturePage(); return true; }
    setSession(next);
    return true;
  };
  const reload = async (): Promise<void> => {
    if (!session || capturePageFinished) return;
    const revision = selectionRevision.current;
    const snapshot = snapshotRevision.current;
    const next = await api<CaptureSession>(`/api/sessions/${session.id}`);
    // A mutation or a newer snapshot can make an earlier REST response obsolete.
    if (snapshotRevision.current === snapshot) receiveSession(next, revision);
  };
  useEffect(() => {
    if (session) return;
    let alive = true;
    const revision = selectionRevision.current;
    // Refresh all rows when returning to the list, including sessions changed elsewhere.
    void api<CaptureSession[]>('/api/sessions').then(next => {
      if (alive && isCurrentSelection(revision) && selectedSessionId.current === undefined) setSessions(next);
    }).catch(reason => {
      if (alive && isCurrentSelection(revision) && selectedSessionId.current === undefined) setError(failure(reason));
    });
    return () => { alive = false; };
  }, [session?.id]);
  useEffect(() => {
    if (!session) return;
    if (mobile && session.state === 'Finalized') { finishCapturePage(); return; }
    const revision = selectionRevision.current;
    return watchCaptureSession(session.id, reload, status => {
      if (isCurrentSelection(revision, session.id)) setConnection(status);
    });
  }, [session?.id, mobile && session?.state === 'Finalized']);
  useEffect(() => {
    let alive = true;
    setQr('');
    if (invitation) void QRCode.toDataURL(invitation.url, { width: 280, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#102d25', light: '#ffffff' } }).then(value => { if (alive) setQr(value); });
    return () => { alive = false; };
  }, [invitation]);

  async function mutate(action: () => Promise<void>): Promise<void> {
    const revision = ++mutationRevision.current;
    setError(''); setBusy(true);
    try { await action(); }
    catch (reason) { if (mutationRevision.current === revision) setError(failure(reason)); }
    finally { if (mutationRevision.current === revision) setBusy(false); }
  }
  async function invite(id: string, revision = selectionRevision.current): Promise<void> {
    const next = await api<{ url: string; expiresAt: string }>(`/api/sessions/${id}/invitation`, {});
    if (!isCurrentSelection(revision, id)) return;
    const snapshot = ++snapshotRevision.current;
    setInvitation(next);
    const updated = await api<CaptureSession>(`/api/sessions/${id}`);
    if (snapshotRevision.current === snapshot) receiveSession(updated, revision);
  }
  async function create(): Promise<void> {
    const revision = ++selectionRevision.current;
    selectedSessionId.current = undefined;
    selectedSnapshot.current = undefined;
    setInvitation(undefined); setConnection('Connexion au serveur…');
    const next = await api<CaptureSession>('/api/sessions', { category: 'vinyl', businessReference: reference, direct: mobile });
    if (!isCurrentSelection(revision)) { rememberSession(next); return; }
    selectedSessionId.current = next.id;
    receiveSession(next, revision);
    if (!mobile) await invite(next.id, revision);
  }
  async function select(next: CaptureSession): Promise<void> {
    const revision = ++selectionRevision.current;
    selectedSessionId.current = next.id;
    selectedSnapshot.current = undefined;
    setInvitation(undefined); setConnection('Connexion au serveur…');
    receiveSession(await api<CaptureSession>(`/api/sessions/${next.id}`), revision);
  }
  async function changeSession(id: string, action: 'confirm' | 'cancel', body: unknown): Promise<void> {
    const revision = selectionRevision.current;
    const next = await api<CaptureSession>(`/api/sessions/${id}/${action}`, body);
    if (receiveSession(next, revision)) setInvitation(undefined);
  }
  function clearSelection(): void {
    selectionRevision.current++; mutationRevision.current++; snapshotRevision.current++;
    selectedSessionId.current = undefined;
    selectedSnapshot.current = undefined;
    setSession(undefined); setInvitation(undefined); setError(''); setBusy(false);
  }

  if (mobile && session?.state === 'Finalized') return null;
  return <>
    <section className="intro"><div><div className="eyebrow">Capture mobile · reçu portable</div><h1>Un dossier photo,<br /><span>des fichiers vérifiables.</span></h1><p className="lead">Prenez vos photos sur téléphone. Retrouvez les originaux et leur reçu signé dans un même dossier.</p></div><div className="workflow"><span><b>01</b>Créer un dossier</span><i /><span><b>02</b>{mobile ? 'Prendre les photos' : 'Appairer le téléphone'}</span><i /><span><b>03</b>Recevoir le reçu</span></div></section>
    {!session ? <section className="panel start-panel"><div><div className="eyebrow">Nouvelle session</div><h2>{mobile ? 'Démarrer sur ce téléphone' : 'Préparer votre dossier'}</h2><p>{mobile ? 'La caméra s’ouvrira uniquement après votre autorisation.' : 'Votre ordinateur suit la réception. Votre téléphone prend les photos.'}</p><div className="policy-chips"><span>1 à 3 photos</span><span>JPEG uniquement</span><span>Catégorie : vinyl</span></div></div><form onSubmit={event => { event.preventDefault(); void mutate(create); }}><label>Référence métier<input value={reference} maxLength={100} required onChange={event => setReference(event.target.value)} /></label><button className="primary" disabled={busy}>{busy ? 'Création…' : mobile ? 'Commencer la capture mobile' : 'Créer une session'}<span aria-hidden="true">↗</span></button><small>Identité anonyme de démonstration, sans compte.</small></form></section>
      : <div className="session-layout"><section className="panel session-main" aria-busy={busy}><div className="section-top"><div><div className="eyebrow">Dossier en cours</div><h2>{session.context.businessReference}</h2></div><Status session={session} /></div><p className="connection"><span className="live-dot" />{connection}</p>
        {mobile && session.state === 'Capturing' ? <CaptureView session={session} /> : <Gallery session={session} />}
        <div className="gallery-summary"><strong>{session.photos.length} / {session.policy.maxPhotos} photos reçues</strong><span>Minimum {session.policy.minPhotos} · {Math.round(session.policy.maxBytesPerPhoto / 1024 / 1024)} Mio par photo</span></div>
        {session.state === 'Finalized' && <div className="completion"><h3>Le dossier est finalisé</h3><p>Les fichiers et le reçu sont désormais immuables. Téléchargez chaque original et le reçu pour une vérification indépendante.</p><div className="actions"><button className="primary" onClick={() => void mutate(async () => { const receipt = await api<{ jws: string }>(`/api/sessions/${session.id}/receipt`); download('receipt.jws', receipt.jws, 'application/jose'); })}>Télécharger le reçu</button><button onClick={() => void mutate(async () => download('captureproof-public-keys.json', JSON.stringify(await api('/api/keys'), null, 2), 'application/json'))}>Exporter les clés publiques</button></div><small>Une clé exportée doit être reconnue explicitement avant toute vérification.</small></div>}
        {['Cancelled', 'Expired'].includes(session.state) && <p>Cette session est fermée. Créez-en une nouvelle pour continuer.</p>}
      </section><aside className="panel pairing"><div className="eyebrow">{mobile ? 'Votre session' : 'Connexion du téléphone'}</div>
        {!mobile && session.state === 'AwaitingPairing' && <><h2>Scannez et comparez</h2><p>Ouvrez l’appareil photo de votre téléphone et scannez ce QR code.</p><div className="qr-frame">{qr ? <img src={qr} alt="QR code d’appairage" width="280" height="280" /> : <span>Préparation de l’invitation…</span>}</div>{invitation && <><p className="muted">Invitation valable jusqu’à {new Date(invitation.expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.</p><details><summary>Accès manuel à l’invitation</summary><a href={invitation.url} data-testid="invitation-link" rel="noreferrer">Ouvrir l’invitation</a></details></>}<button disabled={busy} onClick={() => void mutate(() => invite(session.id))}>{invitation ? 'Régénérer le QR code' : 'Créer un QR code'}</button></>}
        {!mobile && session.state === 'PendingConfirmation' && <><h2>Vérifiez le téléphone</h2><p>Le même code doit apparaître sur les deux écrans.</p><div className="pair-code"><strong data-testid="confirmation-code">{session.confirmationCode}</strong></div><button className="primary" disabled={busy} onClick={() => void mutate(() => changeSession(session.id, 'confirm', { accept: true }))}>Les codes correspondent</button><button disabled={busy} onClick={() => void mutate(() => changeSession(session.id, 'confirm', { accept: false }))}>Refuser ce téléphone</button></>}
        {session.state === 'Capturing' && <><h2>{mobile ? 'Capture en cours' : 'Téléphone autorisé'}</h2><p>{mobile ? 'Chaque photo est envoyée au serveur après la prise.' : 'Prenez vos photos sur le téléphone, puis terminez le dossier. Cet écran se met à jour automatiquement.'}</p><div className="paired-symbol" aria-hidden="true">✓</div></>}
        {session.state === 'Finalized' && <><h2>Reçu signé disponible</h2><p>Vous pouvez maintenant vérifier le dossier et son contexte à l’aide des fichiers originaux.</p><a className="button" href="/verify">Ouvrir le vérificateur</a></>}
        <div className="session-meta"><span>Expiration de la session</span><strong>{new Date(session.expiresAt).toLocaleString('fr-FR')}</strong></div>
        {!['Finalized', 'Cancelled', 'Expired'].includes(session.state) && <button className="subtle danger" disabled={busy} onClick={() => void mutate(() => changeSession(session.id, 'cancel', {}))}>Annuler la session</button>}
        <button className="subtle" onClick={clearSelection}>Créer un autre dossier</button>
      </aside></div>}
    {error && <p className="error" role="alert">{error}</p>}
    {!session && sessions.length > 0 && <section className="recent"><h2>Dossiers de ce navigateur</h2><div>{sessions.slice(0, 8).map(item => <button key={item.id} className="recent-row" onClick={() => void mutate(() => select(item))}><span>{item.context.businessReference}</span><small>{labels[item.state]}</small><span aria-hidden="true">→</span></button>)}</div></section>}
    <section className="limits"><div className="limit-icon" aria-hidden="true">i</div><div><h3>Ce que le reçu établit</h3><p>Il permet de contrôler que les fichiers correspondent au dossier finalisé et à sa référence métier. Il ne certifie pas l’authenticité de l’objet ni l’absence d’IA.</p><a href="/standalone">Essayer la capture seule, sans preuve serveur</a></div></section>
  </>;
}

function Standalone(): React.JSX.Element {
  return <section className="panel narrow"><div className="eyebrow">Mode distinct</div><h1>Capture seule</h1><div className="notice">Les photos restent en mémoire dans ce navigateur. Aucun serveur, aucun reçu signé, aucune garantie d’intégrité portable.</div>{mobile ? <CaptureView standalone /> : <p>Ouvrez cette page sur un téléphone pour prendre des photos. Aucune caméra n’est demandée sur ordinateur.</p>}</section>;
}
const captureMatch = /^\/capture\/([a-zA-Z0-9-]+)\/?$/.exec(initialPath);
createRoot(document.getElementById('root')!).render(<Shell>{initialPath === '/verify' ? <Verify /> : initialPath === '/standalone' ? <Standalone /> : captureMatch ? <PhonePage id={captureMatch[1]} /> : <Home />}</Shell>);
