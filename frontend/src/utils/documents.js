// Règles identiques à celles du document-service (DocumentFileController) : le serveur reste l'autorité,
// ces contrôles évitent seulement un aller-retour inutile.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_NAME_LENGTH = 255;
export const ALLOWED_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'txt', 'rtf', 'csv',
  'jpg', 'jpeg', 'png', 'gif', 'webp'
];
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',');

export function fileExtension(name) {
  const text = String(name || '');
  const dot = text.lastIndexOf('.');
  return dot < 0 ? '' : text.slice(dot + 1).toLowerCase();
}

export function validateUploadFile(file) {
  if (!file) return 'Choisissez un fichier.';
  if (!file.name || file.name.length > MAX_FILE_NAME_LENGTH) {
    return `Le nom du fichier est trop long (${MAX_FILE_NAME_LENGTH} caractères maximum).`;
  }
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) {
    return 'Type de fichier non accepté (PDF, Word, Excel, PowerPoint, texte ou image).';
  }
  if (!(file.size > 0)) return 'Le fichier est vide.';
  if (file.size > MAX_FILE_BYTES) return 'Le fichier dépasse 10 Mo.';
  return null;
}

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function describeDocumentError(error, { download = false } = {}) {
  const status = error?.status;
  if (status === 403) return 'Action non autorisée pour votre rôle ou pour ce dossier.';
  if (status === 404 && download) {
    return 'Aucun fichier n’est enregistré pour ce document (il a été ajouté avant l’activation du stockage).';
  }
  if (status === 404) return 'Document ou dossier introuvable.';
  if (status === 413) return 'Fichier trop volumineux (10 Mo maximum).';
  return error?.message || 'Une erreur est survenue.';
}
