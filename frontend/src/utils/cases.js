import { getStatusDisplay } from '../constants/caseStatus.js';

export const MAX_NOTE_LENGTH = 1000;
const ALL_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'COURT_PROCEEDING', 'CLOSED', 'ARCHIVED'];

// Mêmes règles que CaseStatusRules (case-service) : pas de changement vers le même statut, un dossier archivé
// ne bouge plus, et on n'archive qu'un dossier clôturé. Le serveur reste l'autorité.
export function allowedNextStatuses(current) {
  if (!ALL_STATUSES.includes(current) || current === 'ARCHIVED') return [];
  return ALL_STATUSES.filter((status) => {
    if (status === current) return false;
    if (status === 'ARCHIVED') return current === 'CLOSED';
    return true;
  });
}

export function validateNote(note) {
  if (String(note || '').trim().length > MAX_NOTE_LENGTH) {
    return `La note est trop longue (${MAX_NOTE_LENGTH} caractères maximum).`;
  }
  return null;
}

const STATUS_CHANGE = /^([A-Z_]+) -> ([A-Z_]+)(?: \| ([\s\S]*))?$/;

/** Transforme un événement du case-service en ligne d'historique lisible. */
export function describeHistoryEvent(event) {
  const type = event?.type;
  const description = event?.description || '';

  if (type === 'CASE_CREATED') {
    return { title: 'Dossier ouvert', detail: '', note: '' };
  }

  if (type === 'STATUS_CHANGED') {
    const match = STATUS_CHANGE.exec(description);
    if (match) {
      return {
        title: 'Statut modifié',
        detail: `${getStatusDisplay(match[1]).label} → ${getStatusDisplay(match[2]).label}`,
        note: (match[3] || '').trim()
      };
    }
    return { title: 'Statut modifié', detail: description, note: '' };
  }

  return { title: type || 'Événement', detail: description, note: '' };
}

export function sortEventsNewestFirst(events) {
  return [...(Array.isArray(events) ? events : [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function describeStatusChangeError(error) {
  switch (error?.status) {
    case 400:
      return 'Statut ou note invalide.';
    case 403:
      return 'Vous n’avez pas le droit de changer le statut de ce dossier.';
    case 404:
      return 'Dossier introuvable ou non attribué à votre compte.';
    case 409:
      return 'Ce changement de statut n’est pas permis (même statut, dossier archivé, ou dossier non clôturé).';
    default:
      return error?.message || 'Impossible de changer le statut.';
  }
}
