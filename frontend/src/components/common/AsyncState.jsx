import { useLanguage } from '../../context/LanguageContext';
import Icon from './Icon';

/**
 * Affiche l'état d'un chargement : squelette, erreur (avec bouton Réessayer),
 * liste vide, ou le contenu (children) quand tout est prêt.
 */
export default function AsyncState({
  loading,
  error,
  onRetry,
  isEmpty = false,
  emptyMessage = 'Aucune donnée pour le moment.',
  loadingMessage = 'Chargement…',
  children
}) {
  const { tr } = useLanguage();
  if (loading) {
    return (
      <div role="status" aria-label={tr(loadingMessage)} className="space-y-3">
        <div className="skeleton h-14 w-full" />
        <div className="skeleton h-14 w-11/12" />
        <div className="skeleton h-14 w-10/12" />
        <span className="sr-only">{tr(loadingMessage)}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4" role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
          <Icon name="alert" className="h-4 w-4" /> {tr('Impossible de charger les données.')}
        </p>
        <p className="mt-1 text-sm text-rose-600">
          {error.status ? `Erreur ${error.status} : ` : ''}
          {error.message}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100">
            {tr('Réessayer')}
          </button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
          <Icon name="inbox" className="h-5 w-5" />
        </span>
        <p className="text-sm text-slate-500">{tr(emptyMessage)}</p>
      </div>
    );
  }

  return children;
}
