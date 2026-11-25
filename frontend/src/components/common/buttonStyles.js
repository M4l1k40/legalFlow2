const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-55';

export const primaryButton = `${base} bg-slate-900 text-white shadow-sm hover:bg-slate-700`;
export const accentButton = `${base} bg-brand-500 text-white shadow-sm hover:bg-brand-600`;
export const secondaryButton = `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const dangerButton = `${base} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`;
