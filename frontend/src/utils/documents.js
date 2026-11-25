// Règles partagées de la page Documents (validation côté navigateur ; le serveur reste l'autorité).
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo, aligné sur spring.servlet.multipart du document-service

export const VISIBILITY_OPTIONS = [
  { value: 'CASE_MEMBERS', label: 'Équipe et client du dossier', tone: 'emerald' },
  { value: 'LAWYER_ONLY', label: 'Avocats uniquement', tone: 'amber' },
  { value: 'PRIVATE', label: 'Privé (moi et administrateur)', tone: 'rose' }
];

export function getVisibilityDisplay(value) {
  const found = VISIBILITY_OPTIONS.find((option) => option.value === value);
  return found ? { label: found.label, tone: found.tone } : { label: value || '—', tone: 'slate' };
}

export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1).replace('.', ',')} Ko`;
  return `${(value / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function validateUpload({ caseId, file }) {
  const errors = {};
  if (!caseId) errors.caseId = 'Choisissez un dossier.';
  if (!file) errors.file = 'Choisissez un fichier.';
  else if (file.size === 0) errors.file = 'Le fichier est vide.';
  else if (file.size > MAX_FILE_SIZE) errors.file = `Le fichier dépasse ${formatFileSize(MAX_FILE_SIZE)}.`;
  return errors;
}

export function describeDocumentError(error) {
  if (error.status === 400) return 'Requête invalide (fichier manquant ou illisible).';
  if (error.status === 403) return "Vous n'avez pas le droit d'effectuer cette action.";
  if (error.status === 404) return 'Document ou dossier introuvable.';
  if (error.status === 413) return 'Fichier trop volumineux.';
  if (error.status === 422) return 'Ce dossier est inaccessible pour votre compte.';
  if (error.status === 503) return 'Service momentanément indisponible, réessayez.';
  return error.message || 'Opération impossible.';
}

export function iconForFile(fileType = '') {
  if (fileType.startsWith('image/')) return 'eye';
  return 'file';
}
