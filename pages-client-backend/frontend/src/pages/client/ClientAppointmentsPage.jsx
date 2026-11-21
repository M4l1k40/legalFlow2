import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { formatDateTime, groupAppointments } from '../../utils/appointments';

// Correspond aux enums AppointmentType / AppointmentStatus de l'appointment-service
const TYPE_LABELS = {
  CLIENT_MEETING: 'Rendez-vous au cabinet',
  COURT_HEARING: 'Audience',
  CONSULTATION: 'Consultation',
  INTERNAL_MEETING: 'Réunion'
};
const STATUS = {
  SCHEDULED: { label: 'Planifié', tone: 'blue' },
  COMPLETED: { label: 'Terminé', tone: 'emerald' },
  CANCELLED: { label: 'Annulé', tone: 'slate' }
};

function AppointmentList({ items, emptyMessage }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const status = STATUS[item.status] || { label: item.status, tone: 'slate' };
        return (
          <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="font-medium text-slate-800">{TYPE_LABELS[item.type] || item.type}</div>
              <div className="text-sm text-slate-500">{formatDateTime(item.dateTime)}</div>
              {item.location && <div className="text-sm text-slate-600">Lieu : {item.location}</div>}
              {item.notes && <div className="mt-1 text-sm text-slate-600">{item.notes}</div>}
            </div>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientAppointmentsPage() {
  const { data, loading, error, refetch } = useApi('/api/appointments');
  const groups = useMemo(() => groupAppointments(data, new Date()), [data]);
  const isEmpty = !Array.isArray(data) || data.length === 0;

  return (
    <div>
      <PageHeader eyebrow="Mes rendez-vous" title="Vos rendez-vous" description="Retrouvez vos prochains rendez-vous avec le cabinet et votre historique." />
      <AsyncState loading={loading} error={error} onRetry={refetch} isEmpty={isEmpty} emptyMessage="Aucun rendez-vous pour le moment." loadingMessage="Chargement de vos rendez-vous…">
        <div className="space-y-6">
          <SectionCard title="À venir">
            <AppointmentList items={groups.upcoming} emptyMessage="Aucun rendez-vous à venir." />
          </SectionCard>
          {groups.toClose.length > 0 && (
            <SectionCard title="En attente de clôture par le cabinet">
              <AppointmentList items={groups.toClose} emptyMessage="" />
            </SectionCard>
          )}
          <SectionCard title="Historique">
            <AppointmentList items={[...groups.completed, ...groups.cancelled]} emptyMessage="Aucun rendez-vous passé." />
          </SectionCard>
        </div>
      </AsyncState>
    </div>
  );
}
