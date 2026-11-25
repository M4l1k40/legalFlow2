import { useLanguage } from '../../context/LanguageContext';
export default function SectionCard({ title, action, children, className = '' }) {
  const { tr } = useLanguage();
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      {title || action ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-base font-semibold text-slate-900">{tr(title)}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
