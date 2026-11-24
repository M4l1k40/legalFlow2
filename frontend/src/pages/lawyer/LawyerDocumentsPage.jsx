import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import FormField, { inputClass } from '../../components/common/FormField';
import { primaryButton, secondaryButton, dangerButton } from '../../components/common/buttonStyles';
import useApi from '../../hooks/useApi';
import useAction from '../../hooks/useAction';
import { api } from '../../services/api';
import { keycloak } from '../../context/AuthContext';
import { downloadDocumentFile } from '../../utils/downloadFile';
import {
  ACCEPT_ATTRIBUTE,
  describeDocumentError,
  formatFileSize,
  validateUploadFile
} from '../../utils/documents';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

// Pour changer la visibilité, on renvoie le document tel quel : le serveur garde la clé de stockage.
function toPayload(doc, overrides = {}) {
  return {
    caseId: doc.caseId,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    storageKey: doc.storageKey,
    description: doc.description || null,
    visibility: doc.visibility,
    ...overrides
  };
}

export default function LawyerDocumentsPage() {
  // La secrétaire peut envoyer et télécharger ; changer la visibilité ou supprimer reste réservé à l'avocat et à l'administrateur.
  const isOffice = Boolean(keycloak.hasRealmRole?.('ADMIN') || keycloak.hasRealmRole?.('SECRETARY'));
  const canManage = Boolean(keycloak.hasRealmRole?.('ADMIN') || keycloak.hasRealmRole?.('LAWYER'));
  const casesApi = useApi('/api/cases');
  const cases = useMemo(() => (Array.isArray(casesApi.data) ? casesApi.data : []), [casesApi.data]);
  const [pickedCaseId, setCaseId] = useState('');
  const caseId = pickedCaseId || cases[0]?.id || '';
  const [showForm, setShowForm] = useState(false);
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('CASE_MEMBERS');
  const [fieldError, setFieldError] = useState(null);
  const { busyKey, feedback, run, clearFeedback } = useAction();

  const documentsApi = useApi(caseId ? `/api/documents/case/${caseId}` : null, { enabled: Boolean(caseId) });
  const documents = Array.isArray(documentsApi.data) ? documentsApi.data : [];
  const selectedCase = cases.find((item) => item.id === caseId);

  function resetForm() {
    setShowForm(false);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setDescription('');
    setVisibility('CASE_MEMBERS');
    setFieldError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validateUploadFile(file);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError(null);

    // Le fichier part avec sa fiche : le serveur enregistre le contenu et crée le document.
    const data = new FormData();
    data.append('file', file);
    data.append('caseId', caseId);
    data.append('visibility', visibility);
    if (description.trim()) data.append('description', description.trim());

    const ok = await run('create', () => api.post('/api/documents/upload', data), 'Document envoyé.', describeDocumentError);
    if (ok) {
      resetForm();
      documentsApi.refetch();
    }
  }

  async function toggleVisibility(doc) {
    const next = doc.visibility === 'CASE_MEMBERS' ? 'PRIVATE' : 'CASE_MEMBERS';
    const message = next === 'CASE_MEMBERS' ? 'Document partagé avec le client.' : 'Document rendu privé.';
    const ok = await run(`vis-${doc.id}`, () => api.put(`/api/documents/${doc.id}`, toPayload(doc, { visibility: next })), message, describeDocumentError);
    if (ok) documentsApi.refetch();
  }

  async function download(doc) {
    await run(`dl-${doc.id}`, () => downloadDocumentFile(doc.id, doc.fileName), 'Téléchargement lancé.', (error) => describeDocumentError(error, { download: true }));
  }

  async function remove(doc) {
    if (!window.confirm(`Supprimer « ${doc.fileName} » ? Le fichier sera aussi effacé.`)) return;
    const ok = await run(`del-${doc.id}`, () => api.delete(`/api/documents/${doc.id}`), 'Document supprimé.', describeDocumentError);
    if (ok) documentsApi.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isOffice ? 'Administration' : 'Espace avocat'}
        title="Documents"
        description="Envoyez des documents dans un dossier et choisissez ceux que le client peut télécharger."
        action={
          caseId && !showForm ? (
            <button type="button" className={primaryButton} onClick={() => { clearFeedback(); setShowForm(true); }}>
              Envoyer un document
            </button>
          ) : null
        }
      />

      {feedback ? (
        <div className={`rounded-xl border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {feedback.message}
        </div>
      ) : null}

      <AsyncState
        loading={casesApi.loading}
        error={casesApi.error}
        onRetry={casesApi.refetch}
        isEmpty={cases.length === 0}
        emptyMessage="Aucun dossier pour le moment. Créez d’abord un dossier."
        loadingMessage="Chargement des dossiers…"
      >
        <div className="space-y-6">
          <SectionCard title="Dossier">
            <FormField label="Dossier concerné" htmlFor="documentCase">
              <select id="documentCase" className={inputClass} value={caseId} onChange={(event) => { setCaseId(event.target.value); resetForm(); }}>
                {cases.map((item) => (
                  <option key={item.id} value={item.id}>{item.reference} · {item.title}</option>
                ))}
              </select>
            </FormField>
          </SectionCard>

          {showForm ? (
            <SectionCard title="Envoyer un document">
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormField label="Fichier" htmlFor="documentFile" required error={fieldError} hint="PDF, Word, Excel, PowerPoint, texte ou image · 10 Mo maximum">
                  <input
                    key={fileInputKey}
                    id="documentFile"
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    className={inputClass}
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    disabled={busyKey === 'create'}
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Description" htmlFor="documentDescription">
                    <input id="documentDescription" className={inputClass} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} disabled={busyKey === 'create'} />
                  </FormField>
                  <FormField label="Visibilité" htmlFor="documentVisibility">
                    <select id="documentVisibility" className={inputClass} value={visibility} onChange={(event) => setVisibility(event.target.value)} disabled={busyKey === 'create'}>
                      <option value="CASE_MEMBERS">Partagé avec le client</option>
                      <option value="PRIVATE">Privé (cabinet uniquement)</option>
                    </select>
                  </FormField>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={primaryButton} disabled={busyKey === 'create'}>
                    {busyKey === 'create' ? 'Envoi en cours…' : 'Envoyer'}
                  </button>
                  <button type="button" className={secondaryButton} onClick={resetForm} disabled={busyKey === 'create'}>Annuler</button>
                </div>
              </form>
            </SectionCard>
          ) : null}

          <SectionCard title={selectedCase ? `Documents · ${selectedCase.reference}` : 'Documents'}>
            <AsyncState
              loading={documentsApi.loading}
              error={documentsApi.error}
              onRetry={documentsApi.refetch}
              isEmpty={documents.length === 0}
              emptyMessage="Aucun document dans ce dossier."
              loadingMessage="Chargement des documents…"
            >
              <div className="space-y-3">
                {documents.map((doc) => {
                  const shared = doc.visibility === 'CASE_MEMBERS';
                  return (
                    <div key={doc.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all font-medium text-slate-800">{doc.fileName}</span>
                          <StatusBadge tone={shared ? 'emerald' : 'slate'}>{shared ? 'Partagé avec le client' : 'Privé'}</StatusBadge>
                        </div>
                        <div className="text-sm text-slate-500">
                          {doc.fileType} · {formatFileSize(doc.fileSize)} · Ajouté le {formatDate(doc.createdAt)}
                        </div>
                        {doc.description ? <div className="mt-1 text-sm text-slate-600">{doc.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button type="button" className={secondaryButton} disabled={Boolean(busyKey)} onClick={() => download(doc)}>
                          {busyKey === `dl-${doc.id}` ? 'Téléchargement…' : 'Télécharger'}
                        </button>
                        {canManage ? (
                          <>
                            <button type="button" className={secondaryButton} disabled={Boolean(busyKey)} onClick={() => toggleVisibility(doc)}>
                              {shared ? 'Rendre privé' : 'Partager'}
                            </button>
                            <button type="button" className={dangerButton} disabled={Boolean(busyKey)} onClick={() => remove(doc)}>Supprimer</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AsyncState>
          </SectionCard>
        </div>
      </AsyncState>
    </div>
  );
}
