import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import AsyncState from '../../components/common/AsyncState';
import { secondaryButton } from '../../components/common/buttonStyles';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { downloadDocumentFile } from '../../utils/downloadFile';
import { describeDocumentError, formatFileSize } from '../../utils/documents';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

// Le document-service n'a pas de « liste de mes documents » : on lit ceux de chaque dossier du client.
// Le serveur ne renvoie au client que les documents partagés (visibilité CASE_MEMBERS).
export default function ClientDocumentsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const casesState = useApi('/api/cases');
  const [docs, setDocs] = useState({ loading: true, error: null, groups: [] });
  const [reload, setReload] = useState(0);
  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || casesState.loading) return undefined;
    if (casesState.error) {
      setDocs({ loading: false, error: casesState.error, groups: [] });
      return undefined;
    }
    let active = true;
    const cases = Array.isArray(casesState.data) ? casesState.data : [];
    setDocs((previous) => ({ ...previous, loading: true, error: null }));
    Promise.all(
      cases.map((item) =>
        api.get(`/api/documents/case/${item.id}`).then((list) => ({ case: item, documents: Array.isArray(list) ? list : [] }))
      )
    )
      .then((groups) => active && setDocs({ loading: false, error: null, groups }))
      .catch((error) => active && setDocs({ loading: false, error, groups: [] }));
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, casesState.loading, casesState.error, casesState.data, reload]);

  async function download(doc) {
    setDownloadError(null);
    setDownloading(doc.id);
    try {
      await downloadDocumentFile(doc.id, doc.fileName);
    } catch (error) {
      setDownloadError(describeDocumentError(error, { download: true }));
    } finally {
      setDownloading(null);
    }
  }

  const visible = docs.groups.filter((group) => group.documents.length > 0);

  return (
    <div>
      <PageHeader eyebrow="Mes documents" title="Documents de vos dossiers" description="Les documents que votre cabinet a partagés avec vous, classés par dossier." />
      {downloadError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{downloadError}</div>
      ) : null}
      <AsyncState
        loading={casesState.loading || docs.loading}
        error={docs.error}
        onRetry={() => { casesState.refetch(); setReload((key) => key + 1); }}
        isEmpty={visible.length === 0}
        emptyMessage="Aucun document partagé pour le moment."
        loadingMessage="Chargement de vos documents…"
      >
        <div className="space-y-6">
          {visible.map(({ case: item, documents }) => (
            <SectionCard key={item.id} title={`${item.title} · ${item.reference}`}>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-all font-medium text-slate-800">{doc.fileName}</div>
                      <div className="text-sm text-slate-500">
                        Ajouté le {formatDate(doc.createdAt)}
                        {doc.fileType ? ` · ${doc.fileType}` : ''}
                        {formatFileSize(doc.fileSize) !== '—' ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                      </div>
                      {doc.description && <div className="mt-1 text-sm text-slate-600">{doc.description}</div>}
                    </div>
                    <button type="button" className={secondaryButton} disabled={downloading === doc.id} onClick={() => download(doc)}>
                      {downloading === doc.id ? 'Téléchargement…' : 'Télécharger'}
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      </AsyncState>
    </div>
  );
}
