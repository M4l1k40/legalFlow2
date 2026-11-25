import Icon from './Icon';

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800'
};

export default function Banner({ type = 'info', children, onClose }) {
  if (!children) return null;
  return (
    <div role={type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${STYLES[type] || STYLES.info}`}>
      <span className="flex-1">{children}</span>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Fermer" className="opacity-70 hover:opacity-100">
          <Icon name="x" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
