import { useState } from 'react';
import StatusBadge from '../common/StatusBadge';
import AsyncState from '../common/AsyncState';
import FormField, { inputClass } from '../common/FormField';
import { primaryButton } from '../common/buttonStyles';
import useApi from '../../hooks/useApi';
import useAction from '../../hooks/useAction';
import { api } from '../../services/api';
import { STATUS_DISPLAY, getStatusDisplay } from '../../constants/caseStatus';
import {
  MAX_NOTE_LENGTH,
  allowedNextStatuses,
  describeHistoryEvent,
  describeStatusChangeError,
  formatDateTime,
  sortEventsNewestFirst,
  validateNote
} from '../../utils/cases';

/**
 * Détail d'un dossier : informations, changement de statut et historique.
 * onChanged est appelé après un changement pour que la liste des dossiers se recharge.
 */
export default function CaseDetailPanel({ legalCase, clientName, onChanged }) {
  const eventsApi = useApi(`/api/cases/${legalCase.id}/events`);
  const { busyKey, feedback, run } = useAction();
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(null);

  const status = getStatusDisplay(legalCase.status);
  const options = allowedNextStatuses(legalCase.status);
  const events = sortEventsNewestFirst(eventsApi.data);
  const saving = busyKey === 'status';

  async function handleSubmit(event) {
    event.preventDefault();
    if (!nextStatus) return;
    const problem = validateNote(note);
    if (problem) {
      setNoteError(problem);
      return;
    }
    setNoteError(null);

    if (nextStatus === 'ARCHIVED' && !window.confirm('Archiver ce dossier ? Son statut ne pourra plus être modifié.')) {
      return;
    }

    const ok = await run(
      'status',
      () => api.patch(`/api/cases/${legalCase.id}/status`, { status: nextStatus, note: note.trim() || null }),
      `Statut changé : ${STATUS_DISPLAY[nextStatus]?.label || nextStatus}.`,
      describeStatusChangeError
    );
    if (ok) {
      setNextStatus('');
      setNote('');
      eventsApi.refetch();
      if (onChanged) onChanged();
    }
  }

  return (
    <div className="mt-4 space-y-5 border-t border-slate-200 pt-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-slate-500">Référence</dt>
          <dd className="font-medium text-slate-800">{legalCase.reference}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Client</dt>
          <dd className="font-medium text-slate-800">{clientName || 'Inconnu'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Ouvert le</dt>
          <dd className="font-medium text-slate-800">{formatDateTime(legalCase.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Statut</dt>
          <dd><StatusBadge tone={status.tone}>{status.label}</StatusBadge></dd>
        </div>
      </dl>

      {legalCase.description ? (
        <p className="whitespace-pre-line text-sm text-slate-600">{legalCase.description}</p>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Changer le statut</h3>
        {options.length === 0 ? (
          <p className="text-sm text-slate-500">Ce dossier est archivé : son statut ne peut plus être modifié.</p>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Nouveau statut" htmlFor={`status-${legalCase.id}`}>
                <select
                  id={`status-${legalCase.id}`}
                  className={inputClass}
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                  disabled={saving}
                >
                  <option value="">— Choisir —</option>
                  {options.map((value) => (
                    <option key={value} value={value}>{STATUS_DISPLAY[value]?.label || value}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Note (facultative)" htmlFor={`note-${legalCase.id}`} error={noteError}>
                <input
                  id={`note-${legalCase.id}`}
                  className={inputClass}
                  maxLength={MAX_NOTE_LENGTH}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={saving}
                />
              </FormField>
            </div>
            <button type="submit" className={primaryButton} disabled={!nextStatus || saving}>
              {saving ? 'Enregistrement…' : 'Changer le statut'}
            </button>
          </form>
        )}
        {feedback ? (
          <div className={`mt-3 rounded-xl border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedback.message}
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Historique</h3>
        <AsyncState
          loading={eventsApi.loading && !eventsApi.data}
          error={eventsApi.error}
          onRetry={eventsApi.refetch}
          isEmpty={events.length === 0}
          emptyMessage="Aucun événement enregistré."
          loadingMessage="Chargement de l’historique…"
        >
          <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
            {events.map((event) => {
              const line = describeHistoryEvent(event);
              return (
                <li key={event.id} className="text-sm">
                  <div className="font-medium text-slate-800">
                    {line.title}
                    {line.detail ? <span className="font-normal text-slate-600"> · {line.detail}</span> : null}
                  </div>
                  {line.note ? <div className="text-slate-600">« {line.note} »</div> : null}
                  <div className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</div>
                </li>
              );
            })}
          </ol>
        </AsyncState>
      </div>
    </div>
  );
}
