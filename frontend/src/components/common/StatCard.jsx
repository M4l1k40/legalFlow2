import { useLanguage } from '../../context/LanguageContext';
import Icon from './Icon';

const ACCENTS = {
  blue: 'bg-blue-100 text-blue-700',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
  cyan: 'bg-cyan-100 text-cyan-700'
};

export default function StatCard({ label, value, trend, accent = 'blue', icon }) {
  const { tr } = useLanguage();
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-slate-300">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-400 via-brand-500 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">{tr(label)}</span>
        {icon ? (
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${ACCENTS[accent] || ACCENTS.blue}`}>
            <Icon name={icon} className="h-[18px] w-[18px]" />
          </span>
        ) : null}
      </div>
      <div className="mt-4 font-display text-4xl font-semibold tracking-tight text-slate-900">{value}</div>
      {trend ? <div className="mt-1 text-xs text-slate-500">{tr(trend)}</div> : null}
    </div>
  );
}
