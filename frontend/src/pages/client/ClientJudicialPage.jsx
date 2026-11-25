import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import Icon from '../../components/common/Icon';
import useApi from '../../hooks/useApi';
import { formatDate } from '../../constants/caseStatus';
import {
  CASE_TRANSITIONS,
  getCaseStatusDisplay,
  getEventLabel,
  getHearingStatusDisplay,
  getHearingTypeLabel,
  getProcedureLabel
} from '../../constants/judicialStatus';

const STEPS = ['REGISTERED', 'IN_PROGRESS', 'HEARING_SCHEDULED', 'DELIBERATION', 'JUDGMENT_ISSUED', 'CLOSED'];

const dateTime = (value) =>
  value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—';

function Progress({ status }) {
  const index = Math.max(STEPS.indexOf(status), 0);
  return (
    <ol className="flex items-center gap-1" aria-label="Avancement de la procédure">
      {STEPS.map((step, position) => (
        <li key={step} className="flex flex-1 items-center gap-1" title={getCaseStatusDisplay(step).label}>
          <span className={`h-2 flex-1 rounded-full ${position <= index ? 'bg-brand-500' : 'bg-slate-200'}`} />
        </li>
      ))}
    </ol>
  );
}

function Details({ id }) {
  const hearings = useApi(`/api/judicial-cases/${id}/hearings`);
  const events = useApi(`/api/judicial-cases/${id}/events`);
  const list = (value) => (Array.isArray(value) ? value : []);

  return (
    <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Audiences</h3>
        <AsyncState loading={hearings.loading} error={hearings.error} onRetry={hearings.refetch} isEmpty={list(hearings.data).length === 0} emptyMessage="Aucune audience planifiée.">
          <ul className="space-y-2">
            {list(hearings.data).map((hearing) => {
              const status = getHearingStatusDisplay(hearing.status);
              return (
                <li key={hearing.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{getHearingTypeLabel(hearing.type)}</span>
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  </div>
                  <div className="mt-1 text-slate-500">{dateTime(hearing.dateTime)}{hearing.location ? ` · ${hearing.location}` : ''}</div>
                  {hearing.nextAction ? <div className="mt-1 text-slate-600">Prochaine étape : {hearing.nextAction}</div> : null}
                </li>
              );
            })}
          </ul>
        </AsyncState>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Historique</h3>
        <AsyncState loading={events.loading} error={events.error} onRetry={events.refetch} isEmpty={list(events.data).length === 0} emptyMessage="Aucun événement.">
          <ol className="relative space-y-3 border-s border-slate-200 ps-4">
            {list(events.data).map((event) => (
              <li key={event.id} className="relative text-sm">
                <span className="absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                <div className="font-medium text-slate-800">{getEventLabel(event.type)}</div>
                <div className="text-xs text-slate-500">{dateTime(event.eventDate || event.createdAt)}</div>
                {event.description ? <div className="text-slate-600">{event.description}</div> : null}
              </li>
            ))}
          </ol>
        </AsyncState>
      </div>
    </div>
  );
}

export default function ClientJudicialPage() {
  const { data, loading, error, refetch } = useApi('/api/judicial-cases');
  const [open, setOpen] = useState(null);
  const items = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mes procédures" title="Suivi judiciaire" description="Où en sont vos procédures : statut, audiences à venir et historique." />
      <AsyncState loading={loading} error={error} onRetry={refetch} isEmpty={items.length === 0} emptyMessage="Aucune procédure judiciaire pour le moment.">
        <div className="space-y-4">
          {items.map((item) => {
            const status = getCaseStatusDisplay(item.status);
            const expanded = open === item.id;
            return (
              <SectionCard key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-display text-lg font-semibold text-slate-900">Procédure {getProcedureLabel(item.procedureType).toLowerCase()}</div>
                    <div className="text-sm text-slate-500">N° {item.courtCaseNumber || '—'} · ouverte le {formatDate(item.openingDate)}</div>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <div className="mt-4"><Progress status={item.status} /></div>
                {(CASE_TRANSITIONS[item.status] || []).length === 0 && item.status === 'CLOSED' ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700"><Icon name="check" className="h-3.5 w-3.5" /> Procédure terminée</p>
                ) : null}
                <button type="button" onClick={() => setOpen(expanded ? null : item.id)} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">
                  {expanded ? 'Masquer le détail' : 'Voir audiences et historique'}
                </button>
                {expanded ? <Details id={item.id} /> : null}
              </SectionCard>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}
