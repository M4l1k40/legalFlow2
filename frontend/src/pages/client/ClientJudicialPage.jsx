import { useEffect, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { formatDateTime } from '../../utils/appointments';

// Correspond aux enums du judicial-service
const CASE_STATUS = {
  REGISTERED: { label: 'Enregistrée', tone: 'blue' },
  IN_PROGRESS: { label: 'En cours', tone: 'emerald' },
  HEARING_SCHEDULED: { label: 'Audience programmée', tone: 'violet' },
  DELIBERATION: { label: 'En délibéré', tone: 'amber' },
  JUDGMENT_ISSUED: { label: 'Jugement rendu', tone: 'cyan' },
  CLOSED: { label: 'Clôturée', tone: 'slate' }
};
const PROCEDURE = { CIVIL: 'Civile', COMMERCIAL: 'Commerciale', CRIMINAL: 'Pénale', ADMINISTRATIVE: 'Administrative' };
const HEARING_TYPE = { FIRST_HEARING: 'Première audience', FOLLOW_UP: 'Audience de suivi', PLEADING: 'Plaidoirie' };
const HEARING_STATUS = {
  SCHEDULED: { label: 'Programmée', tone: 'blue' },
  COMPLETED: { label: 'Tenue', tone: 'emerald' },
  POSTPONED: { label: 'Reportée', tone: 'amber' }
};

function formatDay(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
}

export default function ClientJudicialPage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const procedures = useApi('/api/judicial-cases');
  const [details, setDetails] = useState({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !Array.isArray(procedures.data)) return undefined;
    let active = true;
    Promise.all(
      procedures.data.map(async (item) => {
        try {
          const [hearings, events] = await Promise.all([
            api.get(`/api/judicial-cases/${item.id}/hearings`),
            api.get(`/api/judicial-cases/${item.id}/events`)
          ]);
          return [item.id, { ok: true, hearings: hearings || [], events: events || [] }];
        } catch (error) {
          return [item.id, { ok: false, hearings: [], events: [] }];
        }
      })
    ).then((entries) => active && setDetails(Object.fromEntries(entries)));
    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, procedures.data, reload]);

  const list = Array.isArray(procedures.data) ? procedures.data : [];

  return (
    <div>
      <PageHeader eyebrow="Mes procédures" title="Suivi de vos procédures judiciaires" description="Audiences à venir et étapes de chaque procédure en cours." />
      <AsyncState
        loading={procedures.loading}
        error={procedures.error}
        onRetry={() => { procedures.refetch(); setReload((key) => key + 1); }}
        isEmpty={list.length === 0}
        emptyMessage="Aucune procédure judiciaire pour le moment."
        loadingMessage="Chargement de vos procédures…"
      >
        <div className="space-y-6">
          {list.map((item) => {
            const status = CASE_STATUS[item.status] || { label: item.status, tone: 'slate' };
            const detail = details[item.id];
            const hearings = [...(detail?.hearings || [])].sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
            const events = [...(detail?.events || [])].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
            return (
              <SectionCard key={item.id} title={`Procédure ${PROCEDURE[item.procedureType] || item.procedureType || ''}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-slate-600">
                    {item.courtCaseNumber ? `N° ${item.courtCaseNumber} · ` : ''}Ouverte le {formatDay(item.openingDate)}
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>

                {detail && !detail.ok && <p className="mt-3 text-sm text-rose-600">Audiences et événements indisponibles pour le moment.</p>}

                <h3 className="mt-4 text-sm font-semibold text-slate-700">Audiences</h3>
                {hearings.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Aucune audience programmée.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {hearings.map((hearing) => {
                      const hs = HEARING_STATUS[hearing.status] || { label: hearing.status, tone: 'slate' };
                      return (
                        <div key={hearing.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-medium text-slate-800">{HEARING_TYPE[hearing.type] || hearing.type}</div>
                            <div className="text-sm text-slate-500">{formatDateTime(hearing.dateTime)}{hearing.location ? ` · ${hearing.location}` : ''}</div>
                            {hearing.nextAction && <div className="text-sm text-slate-600">Prochaine étape : {hearing.nextAction}</div>}
                          </div>
                          <StatusBadge tone={hs.tone}>{hs.label}</StatusBadge>
                        </div>
                      );
                    })}
                  </div>
                )}

                <h3 className="mt-4 text-sm font-semibold text-slate-700">Historique</h3>
                {events.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">Aucun événement enregistré.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {events.map((event) => (
                      <li key={event.id} className="text-sm text-slate-600">
                        <span className="text-slate-500">{formatDay(event.eventDate)} · </span>
                        {event.description || event.type}
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}
