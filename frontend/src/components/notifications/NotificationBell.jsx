import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import Icon from '../common/Icon';

// Émis par la page Notifications après « marquer comme lu » pour rafraîchir le compteur sans attendre le prochain cycle.
export const NOTIFICATIONS_CHANGED_EVENT = 'legalflow:notifications-changed';

const REFRESH_INTERVAL_MS = 30000;

/**
 * Cloche de l'en-tête : nombre de notifications non lues, rafraîchi toutes les 30 secondes (polling).
 * Une erreur réseau est ignorée : la cloche ne doit jamais perturber la page.
 */
export default function NotificationBell({ to }) {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const items = await api.get('/api/notifications/unread');
      setUnread(Array.isArray(items) ? items.length : 0);
    } catch {
      // volontairement silencieux
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return undefined;
    }
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    };
  }, [authLoading, isAuthenticated, refresh]);

  return (
    <Link
      to={to}
      aria-label={unread > 0 ? `Notifications : ${unread} non lue(s)` : 'Notifications'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
    >
      <Icon name="bell" />
      {unread > 0 ? (
        <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
