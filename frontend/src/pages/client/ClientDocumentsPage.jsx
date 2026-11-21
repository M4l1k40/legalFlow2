import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Le document-service n'a pas de « liste de mes documents » : on lit ceux de chaque dossier du client.
// Le serveur ne renvoie au client que les documents partagés (visibilité CASE_MEMBERS).
export default function ClientDocumentsPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const casesState = useApi('/api/cases');
  const [docs, setDocs] = useState({ loading: true, error: null, groups: [] });
  const [reload, setReload] = useState(0);

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

  const visible = docs.groups.filter((group) => group.documents.length > 0);

  return (
    <div>
      <PageHeader eyebrow="Mes documents" title="Documents de vos dossiers" description="Les documents que votre cabinet a partagés avec vous, classés par dossier." />
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
                  <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="font-medium text-slate-800">{doc.fileName}</div>
                    <div className="text-sm text-slate-500">
                      Ajouté le {formatDate(doc.createdAt)}
                      {doc.fileType ? ` · ${doc.fileType}` : ''}
                      {formatSize(doc.fileSize) ? ` · ${formatSize(doc.fileSize)}` : ''}
                    </div>
                    {doc.description && <div className="mt-1 text-sm text-slate-600">{doc.description}</div>}
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
          <p className="text-xs text-slate-500">Le téléchargement des fichiers n'est pas encore disponible : le serveur ne conserve pour l'instant que les informations des documents.</p>
        </div>
      </AsyncState>
    </div>
  );
}
