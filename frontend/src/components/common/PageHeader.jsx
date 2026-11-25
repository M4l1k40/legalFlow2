import { useLanguage } from '../../context/LanguageContext';
export default function PageHeader({ eyebrow, title, description, action }) {
  const { tr } = useLanguage();
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            <span className="h-px w-6 bg-brand-500" />
            {tr(eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-[34px]">{tr(title)}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{tr(description)}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}
