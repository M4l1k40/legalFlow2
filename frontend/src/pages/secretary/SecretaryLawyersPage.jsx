import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import AsyncState from '../../components/common/AsyncState';
import Icon from '../../components/common/Icon';
import { inputClass } from '../../components/common/FormField';
import useApi from '../../hooks/useApi';

export default function SecretaryLawyersPage() {
  const { data, loading, error, refetch } = useApi('/api/users/lawyers');
  const [query, setQuery] = useState('');
  const lawyers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (Array.isArray(data) ? data : []).filter((item) => !needle || `${item.firstName} ${item.lastName} ${item.username}`.toLowerCase().includes(needle));
  }, [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Espace secrétariat" title="Avocats du cabinet" description="L’équipe d’avocats à laquelle vous pouvez affecter clients et dossiers." />
      <SectionCard
        title={`Équipe${Array.isArray(data) ? ` (${data.length})` : ''}`}
        action={<input aria-label="Rechercher un avocat" placeholder="Rechercher…" className={`${inputClass} max-w-[220px]`} value={query} onChange={(event) => setQuery(event.target.value)} />}
      >
        <AsyncState loading={loading} error={error} onRetry={refetch} isEmpty={lawyers.length === 0} emptyMessage="Aucun avocat trouvé.">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {lawyers.map((lawyer) => (
              <li key={lawyer.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                  {`${lawyer.firstName?.[0] || ''}${lawyer.lastName?.[0] || ''}`.toUpperCase() || <Icon name="users" className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800">{lawyer.firstName} {lawyer.lastName}</div>
                  <div className="truncate text-xs text-slate-500">@{lawyer.username}</div>
                </div>
              </li>
            ))}
          </ul>
        </AsyncState>
      </SectionCard>
    </div>
  );
}
