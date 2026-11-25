import { Link } from 'react-router-dom';
import { Logo } from '../components/common/Icon';
import { useLanguage } from '../context/LanguageContext';

export default function PageNotFound() {
  const { t, dir } = useLanguage();
  return (
    <div dir={dir} className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
      <Logo className="h-12 w-12" />
      <div className="font-display text-7xl font-semibold text-brand-500">404</div>
      <h1 className="text-2xl font-semibold text-slate-900">{t.notFound.title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{t.notFound.text}</p>
      <Link to="/login" className="mt-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
        {t.notFound.back}
      </Link>
    </div>
  );
}
