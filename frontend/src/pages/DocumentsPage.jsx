import { useMemo, useRef, useState } from 'react';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusBadge from '../components/common/StatusBadge';
import AsyncState from '../components/common/AsyncState';
import Banner from '../components/common/Banner';
import Icon from '../components/common/Icon';
import FormField, { inputClass } from '../components/common/FormField';
import { accentButton, dangerButton, secondaryButton } from '../components/common/buttonStyles';
import useApi from '../hooks/useApi';
import useAction from '../hooks/useAction';
import { api, downloadFile } from '../services/api';
import { formatDate, sortByCreatedAtDesc } from '../constants/caseStatus';
import {
  VISIBILITY_OPTIONS,
  describeDocumentError,
  formatFileSize,
  getVisibilityDisplay,
  iconForFile,
  validateUpload
} from '../utils/documents';

/**
 * Documents d'un dossier : liste, téléversement (MinIO via document-service), téléchargement, suppression.
 * `canUpload` / `canDelete` ne servent qu'à masquer les boutons ; le serveur applique les vrais droits.
 */
export default function DocumentsPage({ eyebrow, canUpload = false, canDelete = false, description }) {
  const casesApi = useApi('/api/cases');
  const cases = useMemo(() => sortByCreatedAtDesc(Array.isArray(casesApi.data) ? casesApi.data : []), [casesApi.data]);
  const [caseId, setCaseId] = useState('');
  const selectedCaseId = caseId || cases[0]?.id || '';
  const docsApi = useApi(selectedCaseId ? `/api/documents/case/${selectedCaseId}` : null, { enabled: Boolean(selectedCaseId) });
  const documents = Array.isArray(docsApi.data) ? docsApi.data : [];
  const { busyKey, feedback, run, clearFeedback } = useAction();

  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [visibility, setVisibility] = useState('CASE_MEMBERS');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});

  async function handleUpload(event) {
    event.preventDefault();
    const found = validateUpload({ caseId: selectedCaseId, file });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = new FormData();
    body.append('file', file);
    body.append('caseId', selectedCaseId);
    body.append('visibility', visibility);
    if (note.trim()) body.append('description', note.trim());

    const ok = await run('upload', () => api.post('/api/documents/upload', body), `« ${file.name} » a été téléversé.`, describeDocumentError);
    if (ok) {
      setFile(null);
      setNote('');
      if (fileInput.current) fileInput.current.value = '';
      docsApi.refetch();
    }
  }

  const download = (doc) => run(`dl-${doc.id}`, () => downloadFile(`/api/documents/${doc.id}/download`, doc.fileName), `Téléchargement de « ${doc.fileName} » lancé.`, describeDocumentError);

  async function remove(doc) {
    if (!window.confirm(`Supprimer définitivement « ${doc.fileName} » ?`)) return;
    const ok = await run(`rm-${doc.id}`, () => api.delete(`/api/documents/${doc.id}`), 'Document supprimé.', describeDocumentError);
    if (ok) docsApi.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Documents"
        description={description || 'Pièces et actes rattachés à vos dossiers, stockés de façon sécurisée.'}
        action={
          <select aria-label="Dossier" className={`${inputClass} min-w-[240px]`} value={selectedCaseId} onChange={(event) => { setCaseId(event.target.value); clearFeedback(); }} disabled={cases.length === 0}>
            {cases.length === 0 ? <option value="">Aucun dossier</option> : null}
            {cases.map((item) => (
              <option key={item.id} value={item.id}>{item.reference} — {item.title}</option>
            ))}
          </select>
        }
      />

      {feedback ? <Banner type={feedback.type} onClose={clearFeedback}>{feedback.message}</Banner> : null}

      {canUpload && selectedCaseId ? (
        <SectionCard title="Téléverser un document">
          <form onSubmit={handleUpload} noValidate className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
            <FormField label="Fichier" htmlFor="doc-file" required error={errors.file} hint="25 Mo maximum.">
              <label htmlFor="doc-file" className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition hover:border-brand-500 hover:bg-brand-50 ${errors.file ? 'border-rose-300' : 'border-slate-300'}`}>
                <Icon name="upload" className="h-5 w-5 text-brand-500" />
                <span className="min-w-0 flex-1 truncate text-slate-600">{file ? `${file.name} · ${formatFileSize(file.size)}` : 'Cliquez pour choisir un fichier'}</span>
              </label>
              <input id="doc-file" ref={fileInput} type="file" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setErrors((previous) => ({ ...previous, file: undefined })); }} />
            </FormField>
            <FormField label="Visibilité" htmlFor="doc-visibility">
              <select id="doc-visibility" className={inputClass} value={visibility} onChange={(event) => setVisibility(event.target.value)}>
                {VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Description" htmlFor="doc-note" hint="Optionnel, 2000 caractères maximum.">
                <input id="doc-note" className={inputClass} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className={accentButton} disabled={busyKey === 'upload'}>
                <Icon name="upload" className="h-4 w-4" />
                {busyKey === 'upload' ? 'Téléversement…' : 'Téléverser'}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title={`Documents du dossier${docsApi.data ? ` (${documents.length})` : ''}`}>
        <AsyncState
          loading={casesApi.loading || (Boolean(selectedCaseId) && docsApi.loading)}
          error={casesApi.error || docsApi.error}
          onRetry={() => { casesApi.refetch(); docsApi.refetch(); }}
          isEmpty={!selectedCaseId || documents.length === 0}
          emptyMessage={selectedCaseId ? 'Aucun document pour ce dossier.' : 'Aucun dossier disponible.'}
        >
          <ul className="divide-y divide-slate-100">
            {documents.map((doc) => {
              const vis = getVisibilityDisplay(doc.visibility);
              return (
                <li key={doc.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Icon name={iconForFile(doc.fileType)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{doc.fileName}</div>
                    <div className="truncate text-xs text-slate-500">
                      {formatFileSize(doc.fileSize)} · {formatDate(doc.createdAt)}
                      {doc.description ? ` · ${doc.description}` : ''}
                    </div>
                  </div>
                  {canUpload || canDelete ? <StatusBadge tone={vis.tone}>{vis.label}</StatusBadge> : null}
                  <div className="flex gap-2">
                    <button type="button" className={secondaryButton} onClick={() => download(doc)} disabled={busyKey === `dl-${doc.id}`}>
                      <Icon name="download" className="h-4 w-4" /> Télécharger
                    </button>
                    {canDelete ? (
                      <button type="button" className={dangerButton} onClick={() => remove(doc)} disabled={busyKey === `rm-${doc.id}`} aria-label={`Supprimer ${doc.fileName}`}>
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </AsyncState>
      </SectionCard>
    </div>
  );
}
