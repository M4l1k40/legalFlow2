import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import Icon from '../../components/common/Icon';
import useApi from '../../hooks/useApi';
import { splitAppointments } from '../../utils/appointments';
import { getAppointmentStatusDisplay, getAppointmentTypeLabel } from '../../constants/appointmentStatus';

function Row({ item }) {
  const date = new Date(item.dateTime);
  const status = getAppointmentStatusDisplay(item.status);
  return (
    <li className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-center shadow-sm">
        <span className="text-[10px] font-semibold uppercase text-brand-600">{date.toLocaleDateString('fr-FR', { month: 'short' })}</span>
        <span className="font-display text-xl font-semibold leading-none text-slate-900">{date.getDate()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-800">{getAppointmentTypeLabel(item.type)}</div>
        <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
          <span>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
          {item.location ? <span className="inline-flex items-center gap-1"><Icon name="calendar" className="h-3.5 w-3.5" />{item.location}</span> : null}
        </div>
        {item.notes ? <div className="mt-0.5 truncate text-sm text-slate-500">{item.notes}</div> : null}
      </div>
      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
    </li>
  );
}

export default function ClientAppointmentsPage() {
  const { data, loading, error, refetch } = useApi('/api/appointments');
  // Recalculé à chaque rechargement des données : « à venir » reste juste.
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const { upcoming, past } = useMemo(() => splitAppointments(data, now), [data, now]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mes rendez-vous" title="Rendez-vous" description="Vos rendez-vous avec le cabinet. Pour en modifier un, contactez le secrétariat." />
      <AsyncState loading={loading} error={error} onRetry={refetch} isEmpty={upcoming.length + past.length === 0} emptyMessage="Aucun rendez-vous pour le moment.">
        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title={`À venir (${upcoming.length})`}>
            {upcoming.length ? <ul className="space-y-3">{upcoming.map((item) => <Row key={item.id} item={item} />)}</ul> : <p className="text-sm text-slate-500">Aucun rendez-vous à venir.</p>}
          </SectionCard>
          <SectionCard title={`Passés et annulés (${past.length})`}>
            {past.length ? <ul className="space-y-3">{past.map((item) => <Row key={item.id} item={item} />)}</ul> : <p className="text-sm text-slate-500">Aucun historique.</p>}
          </SectionCard>
        </div>
      </AsyncState>
    </div>
  );
}
