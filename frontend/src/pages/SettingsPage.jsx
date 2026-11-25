import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import StatusBadge from '../components/common/StatusBadge';
import Icon from '../components/common/Icon';
import { secondaryButton } from '../components/common/buttonStyles';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="min-w-0 break-all text-sm font-medium text-slate-800">{children}</dd>
    </div>
  );
}

/** Compte, session et préférences d'affichage — données lues dans le jeton Keycloak, rien n'est inventé. */
export default function SettingsPage() {
  const { user, keycloak, logout } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const s = t.settings;
  const expiry = user?.tokenParsed?.exp ? new Date(user.tokenParsed.exp * 1000).toLocaleString('fr-FR') : '—';

  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={s.subtitle} />
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title={s.account}>
          <dl>
            <Row label={s.name}>{user?.name || '—'}</Row>
            <Row label={s.username}>{user?.username || '—'}</Row>
            <Row label={s.email}>{user?.email || '—'}</Row>
            <Row label={s.roles}>
              <span className="flex flex-wrap gap-1.5">{(user?.roles || []).filter((r) => t.roles[r]).map((r) => <StatusBadge key={r} tone="violet">{t.roles[r]}</StatusBadge>)}</span>
            </Row>
            <Row label={s.firmId}>{user?.lawFirmId || '—'}</Row>
          </dl>
        </SectionCard>

        <SectionCard title={s.display}>
          <dl>
            <Row label={t.common.theme}>
              <span className="inline-flex rounded-xl border border-slate-200 p-0.5">
                {['light', 'dark'].map((mode) => (
                  <button key={mode} type="button" onClick={() => setTheme(mode)} aria-pressed={theme === mode} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${theme === mode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    <Icon name={mode === 'light' ? 'sun' : 'moon'} className="h-3.5 w-3.5" />
                    {mode === 'light' ? t.common.light : t.common.dark}
                  </button>
                ))}
              </span>
            </Row>
            <Row label={t.common.language}>
              <span className="inline-flex rounded-xl border border-slate-200 p-0.5">
                {['fr', 'ar'].map((code) => (
                  <button key={code} type="button" onClick={() => setLanguage(code)} aria-pressed={language === code} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${language === code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {code === 'fr' ? 'Français' : 'العربية'}
                  </button>
                ))}
              </span>
            </Row>
          </dl>
        </SectionCard>

        <SectionCard title={s.session} className="xl:col-span-2">
          <dl>
            <Row label={s.expires}>{expiry}</Row>
            <Row label="Fournisseur d’identité">{keycloak?.authServerUrl || '—'} · realm {keycloak?.realm || '—'}</Row>
          </dl>
          <button type="button" className={`${secondaryButton} mt-4`} onClick={logout}>
            <Icon name="logout" className="h-4 w-4" /> {t.auth.logout}
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
