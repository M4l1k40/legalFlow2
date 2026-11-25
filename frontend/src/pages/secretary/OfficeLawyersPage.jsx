import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { summarizeLawyers } from '../../utils/officeLawyers';

export default function OfficeLawyersPage() {
  const lawyersApi = useApi('/api/users/lawyers');
  const clientsApi = useApi('/api/clients');
  const casesApi = useApi('/api/cases');

  const rows = useMemo(
    () => summarizeLawyers(lawyersApi.data, clientsApi.data, casesApi.data),
    [lawyersApi.data, clientsApi.data, casesApi.data]
  );

  const loading = (lawyersApi.loading && !lawyersApi.data) || (clientsApi.loading && !clientsApi.data) || (casesApi.loading && !casesApi.data);
  const error = lawyersApi.error || clientsApi.error || casesApi.error;
  const retry = () => { lawyersApi.refetch(); clientsApi.refetch(); casesApi.refetch(); };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Avocats du cabinet"
        description="Les avocats actifs, les clients dont ils ont la charge et leurs dossiers en cours."
      />
      <SectionCard title={`Avocats${rows.length ? ` (${rows.length})` : ''}`}>
        <AsyncState
          loading={loading}
          error={error}
          onRetry={retry}
          isEmpty={rows.length === 0}
          emptyMessage="Aucun avocat actif dans ce cabinet."
          loadingMessage="Chargement des avocats…"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Avocat</th>
                  <th className="py-2 pr-4 font-medium">Identifiant</th>
                  <th className="py-2 pr-4 font-medium">Clients en charge</th>
                  <th className="py-2 pr-4 font-medium">Dossiers en cours</th>
                  <th className="py-2 font-medium">Dossiers au total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-4 font-medium text-slate-800">{row.name}</td>
                    <td className="py-3 pr-4 text-slate-600">{row.username}</td>
                    <td className="py-3 pr-4 text-slate-600">
                      <div>{row.clientCount}</div>
                      {row.clientNames.length > 0 ? (
                        <div className="text-xs text-slate-500">{row.clientNames.join(', ')}</div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{row.activeCases}</td>
                    <td className="py-3 text-slate-600">{row.totalCases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AsyncState>
        <p className="mt-4 text-sm text-slate-500">
          Pour changer l’avocat en charge d’un client, utilisez la page{' '}
          <Link to="/secretary/clients" className="font-medium text-slate-900 underline">Clients</Link>.
        </p>
      </SectionCard>
    </div>
  );
}
