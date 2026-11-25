import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

/**
 * Charge une ressource GET via la gateway (avec le token Keycloak).
 *
 *   const { data, loading, error, refetch } = useApi('/api/cases');
 *
 * Options : { enabled: false } pour différer l'appel.
 * L'état « chargement » est dérivé : une réponse n'est valable que pour la requête (endpoint + rechargement) qui l'a produite.
 */
export default function useApi(endpoint, { enabled = true } = {}) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: null });

  const refetch = useCallback(() => setReloadKey((key) => key + 1), []);

  const idle = !enabled || !endpoint;
  const waitingForAuth = !idle && authLoading;
  const unauthenticated = !idle && !authLoading && !isAuthenticated;
  const requestKey = `${endpoint}#${reloadKey}`;

  useEffect(() => {
    if (idle || authLoading || !isAuthenticated) {
      return undefined;
    }

    const controller = new AbortController();

    apiRequest(endpoint, { signal: controller.signal })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }
        setResult({ key: requestKey, data: null, error });
      });

    return () => controller.abort();
  }, [endpoint, idle, authLoading, isAuthenticated, requestKey]);

  if (idle) return { data: null, loading: false, error: null, refetch };
  if (waitingForAuth) return { data: null, loading: true, error: null, refetch };
  if (unauthenticated) return { data: null, loading: false, error: new Error('Utilisateur non authentifié'), refetch };

  const current = result.key === requestKey;
  return {
    data: current ? result.data : null,
    loading: !current,
    error: current ? result.error : null,
    refetch
  };
}
