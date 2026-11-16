import { keycloak } from '../context/AuthContext';
import { ApiError, apiBaseUrl } from '../services/api';

/**
 * Télécharge le fichier d'un document. La requête porte le jeton Keycloak : un simple lien <a href> ne le
 * peut pas, c'est pourquoi le fichier est lu en mémoire puis proposé au navigateur.
 */
export async function downloadDocumentFile(documentId, fileName) {
  try {
    await keycloak.updateToken(30);
  } catch {
    keycloak.login();
    throw new ApiError('Session expirée, reconnexion en cours…', 401);
  }

  const response = await fetch(`${apiBaseUrl}/api/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${keycloak.token}` }
  });

  if (!response.ok) {
    let message = '';
    try {
      const details = await response.json();
      message = details.message || '';
    } catch {
      // Réponse sans JSON : le statut suffit
    }
    throw new ApiError(message, response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName || 'document';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
