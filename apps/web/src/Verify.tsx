import { useRef, useState } from 'react';
import { verifyReceipt, type FileIssue, type VerificationResult } from '@captureproof/receipt-verifier';

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const issueLabels: Record<FileIssue['code'], string> = {
  'missing-file': 'Fichier manquant', 'extra-file': 'Fichier supplémentaire', 'duplicate-file': 'Fichier en double',
  'size-mismatch': 'Taille différente', 'digest-mismatch': 'Contenu modifié', 'invalid-file': 'Nom ou fichier invalide',
};
export function Verify(): React.JSX.Element {
  const [keys, setKeys] = useState<JsonWebKey[]>([]);
  const [receipt, setReceipt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [reference, setReference] = useState('');
  const [space, setSpace] = useState('demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerificationResult>();
  const revision = useRef(0);
  const keysGeneration = useRef(0);
  const receiptGeneration = useRef(0);

  function invalidate(): void {
    revision.current++; setResult(undefined); setError('');
  }

  async function loadKeys(file: File | undefined): Promise<void> {
    invalidate(); setKeys([]);
    const generation = ++keysGeneration.current;
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('Le fichier de clés est trop volumineux.');
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== 'object') throw new Error('Le fichier de clés est invalide.');
      const candidate: unknown = 'keys' in parsed ? parsed.keys : [parsed];
      if (!Array.isArray(candidate) || !candidate.length || candidate.length > 20 || candidate.some(key => !key || typeof key !== 'object')) throw new Error('Fournissez une clé JWK publique ou un ensemble JWKS limité à 20 clés.');
      if (generation === keysGeneration.current) setKeys(candidate as JsonWebKey[]);
    } catch (reason) { if (generation === keysGeneration.current) setError(reason instanceof Error ? reason.message : 'Clés illisibles.'); }
  }
  async function loadReceipt(file: File | undefined): Promise<void> {
    invalidate(); setReceipt('');
    const generation = ++receiptGeneration.current;
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error('Le reçu dépasse la limite de 256 Kio.');
      const text = (await file.text()).trim();
      if (generation === receiptGeneration.current) setReceipt(text);
    } catch (reason) { if (generation === receiptGeneration.current) setError(reason instanceof Error ? reason.message : 'Reçu illisible.'); }
  }
  async function check(): Promise<void> {
    const version = revision.current;
    setError(''); setResult(undefined); setBusy(true);
    try {
      if (files.length > 50 || files.some(file => file.size > MAX_FILE_BYTES) || files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) throw new Error('Dossier trop volumineux : 50 fichiers, 12 Mio par fichier et 40 Mio au total au maximum.');
      const inputs = await Promise.all(files.map(async file => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
      const verified = await verifyReceipt(receipt, inputs, keys, reference ? { integrationSpace: space, businessReference: reference } : undefined);
      if (version === revision.current) setResult(verified);
    } catch (reason) { if (version === revision.current) setError(reason instanceof Error ? reason.message : 'La vérification a échoué.'); }
    finally { setBusy(false); }
  }
  return <section className="panel verifier">
    <div className="eyebrow">Vérificateur indépendant</div><h1>Contrôler un dossier existant</h1>
    <p className="lead">Votre reçu et vos originaux restent dans ce navigateur. Cette vérification n’appelle pas l’API .NET.</p>
    <div className="notice">Importez des clés publiques obtenues par un canal de confiance. Une clé exportée par un serveur doit être reconnue par vous avant utilisation.</div>
    <div className="form-grid">
      <label>1. Clés publiques de confiance <input type="file" accept=".json,application/json" onChange={event => void loadKeys(event.target.files?.[0])} /><small>{keys.length ? `${keys.length} clé(s) importée(s) explicitement` : 'Aucune clé de confiance'}</small></label>
      <label>2. Reçu signé <input type="file" accept=".jws,.txt" onChange={event => void loadReceipt(event.target.files?.[0])} /><small>{receipt ? 'Reçu chargé localement' : 'Fichier receipt.jws'}</small></label>
      <label className="wide">3. Toutes les photos originales <input type="file" accept="image/jpeg,.jpg,.jpeg" multiple onChange={event => { invalidate(); setFiles(Array.from(event.target.files ?? [])); }} /><small>{files.length} fichier(s), noms d’origine conservés</small></label>
      <label>Espace attendu <input value={space} maxLength={100} onChange={event => { invalidate(); setSpace(event.target.value); }} /></label>
      <label>Référence métier attendue, facultative <input value={reference} maxLength={100} placeholder="DEMO-001" onChange={event => { invalidate(); setReference(event.target.value); }} /></label>
    </div>
    <button className="primary" disabled={busy || !keys.length || !receipt || !files.length} onClick={() => void check()}>{busy ? 'Vérification…' : 'Vérifier localement'}</button>
    {error && <p role="alert" className="error">{error}</p>}
    {result && <div className={`verification-result ${result.valid ? 'good' : ''}`} role="status" data-testid="verification-result">
      <h2>{result.valid ? 'Intégrité vérifiée' : 'Vérification à examiner'}</h2>
      <dl className="results">{(['signature', 'key', 'schema', 'files', 'context'] as const).map(key => <div key={key}>
        <dt>{{ signature: 'Signature', key: 'Clé de confiance', schema: 'Format du reçu', files: 'Fichiers', context: 'Contexte' }[key]}</dt>
        <dd>{({ valid: 'Conforme', invalid: 'Non conforme', trusted: 'Reconnue', untrusted: 'Inconnue', 'not-checked': 'Non contrôlé' })[result[key].status]}
          <small>{key === 'context' && result.context.code === 'expected-context-not-provided' ? 'Aucun contexte attendu fourni' : ''}</small>
        </dd>
      </div>)}</dl>
      {result.key.status === 'untrusted' && <p>La clé indiquée par ce reçu ne figure pas parmi les clés importées. Fournissez une clé publique reconnue de l’émetteur.</p>}
      {result.key.status === 'invalid' && <p>Le fichier de clés n’est pas utilisable. Vérifiez qu’il contient des clés publiques valides avec des identifiants distincts.</p>}
      {result.signature.status === 'invalid' && <p>La signature du reçu est invalide. Les contrôles des fichiers et du contexte n’ont pas été effectués.</p>}
      {result.context.code === 'context-mismatch' && <p>Le reçu ne correspond pas à l’espace ou à la référence métier attendus.</p>}
      {result.files.issues.length > 0 && <><p>{result.files.issues.length} anomalie(s) détectée(s) dans les fichiers :</p>
        <ul className="verification-issues" data-testid="verification-issues">{result.files.issues.map((issue, index) => <li key={`${issue.code}:${issue.name}:${index}`} data-code={issue.code}>
          <strong>{issueLabels[issue.code]}</strong><span>{issue.name || 'Nom indisponible'}</span>
        </li>)}</ul>
      </>}
      <p>{result.valid ? 'Intégrité vérifiée. ' : ''}Ce reçu ne certifie ni l’authenticité de l’objet ni l’absence d’IA.</p>
      <p className="muted">L’heure du serveur n’est pas un horodatage indépendant certifié.</p>
    </div>}
  </section>;
}
