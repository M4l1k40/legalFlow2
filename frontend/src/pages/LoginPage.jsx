import { Navigate } from 'react-router-dom';
import Icon, { Logo } from '../components/common/Icon';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { getHomePath } from '../utils/roleHome';

export default function LoginPage() {
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { login, logout, user, loading } = useAuth();
  const homePath = user ? getHomePath(user.roles || []) : null;

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-500">
        {t.common.loading}
      </div>
    );
  }

  if (homePath) {
    return <Navigate to={homePath} replace />;
  }

  const features = [t.login.f1, t.login.f2, t.login.f3];

  return (
    <div dir={dir} className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_1fr]">
      <section className="ink-scope bg-grid relative hidden overflow-hidden bg-slate-950 p-12 text-slate-100 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -end-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -start-24 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <span className="font-display text-2xl font-semibold text-white">{t.appName}</span>
        </div>

        <div className="relative max-w-xl">
          <h1 className="font-display text-4xl font-semibold leading-tight text-white xl:text-5xl">{t.login.heroTitle}</h1>
          <p className="mt-5 text-base leading-relaxed text-slate-300">{t.login.heroText}</p>
          <ul className="mt-8 space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20 text-brand-400">
                  <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.4} />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-slate-400">
          <Icon name="shield" className="h-4 w-4 text-brand-400" />
          Multi-cabinets · RBAC · OpenID Connect
        </div>
      </section>

      <section className="relative flex items-center justify-center p-6">
        <div className="absolute end-4 top-4 flex gap-2">
          <button type="button" onClick={toggleTheme} aria-label={t.common.theme} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button type="button" onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            <Icon name="globe" className="h-4 w-4" />
            {language === 'fr' ? 'AR' : 'FR'}
          </button>
        </div>

        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="font-display text-2xl font-semibold text-slate-900">{t.appName}</span>
          </div>
          <h2 className="font-display text-3xl font-semibold text-slate-900">{t.auth.loginTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{t.auth.loginSubtitle}</p>

          <div className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <button type="button" onClick={login} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700">
              <Icon name="lock" className="h-4 w-4" />
              {t.auth.continue}
            </button>
            {user ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t.auth.noRole}
                <button type="button" onClick={logout} className="mt-2 block font-semibold underline">
                  {t.auth.logout}
                </button>
              </div>
            ) : null}
            <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
              <Icon name="shield" className="h-3.5 w-3.5 text-brand-500" />
              {t.auth.secure}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
