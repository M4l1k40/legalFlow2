import { useLanguage } from '../../context/LanguageContext';
const TONES = {
  slate: ['bg-slate-100 text-slate-700', 'bg-slate-400'],
  blue: ['bg-blue-100 text-blue-700', 'bg-blue-500'],
  emerald: ['bg-emerald-100 text-emerald-700', 'bg-emerald-500'],
  amber: ['bg-amber-100 text-amber-700', 'bg-amber-500'],
  rose: ['bg-rose-100 text-rose-700', 'bg-rose-500'],
  violet: ['bg-violet-100 text-violet-700', 'bg-violet-500'],
  cyan: ['bg-cyan-100 text-cyan-700', 'bg-cyan-500']
};

export default function StatusBadge({ children, tone = 'slate' }) {
  const { tr } = useLanguage();
  const [classes, dot] = TONES[tone] || TONES.slate;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {tr(children)}
    </span>
  );
}
