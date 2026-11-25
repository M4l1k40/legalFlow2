import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon, { Logo } from '../components/common/Icon';
import NotificationBell from '../components/notifications/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { NAV_BY_ROLE, navLabel } from '../config/navigation';

const GROUP_ORDER = ['overview', 'work', 'finance', 'admin', 'account'];

function initials(name) {
  return (name || '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
}

function SidebarContent({ role, items, onNavigate }) {
  const { t } = useLanguage();
  const groups = GROUP_ORDER.map((key) => ({ key, items: items.filter((item) => item.group === key) })).filter((group) => group.items.length);

  return (
    <div className="ink-scope flex h-full flex-col bg-slate-950 text-slate-100">
      <div className="flex items-center gap-3 px-5 py-5">
        <Logo />
        <div>
          <div className="font-display text-xl font-semibold leading-none text-white">{t.appName}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-brand-400">{t.roles[role]}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2" aria-label="Navigation principale">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t.navGroups[group.key]}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <span className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-brand-400" /> : null}
                      <Icon name={item.icon} className={`h-[18px] w-[18px] ${isActive ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="truncate">{navLabel(t, role, item.id)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-xs text-slate-400">
        <div className="flex items-center gap-2"><Icon name="lock" className="h-3.5 w-3.5 text-brand-400" /> Données isolées par cabinet</div>
      </div>
    </div>
  );
}

function QuickNav({ open, onClose, items, role }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => !needle || navLabel(t, role, item.id).toLowerCase().includes(needle));
  }, [items, query, role, t]);

  if (!open) return null;

  function go(item) {
    setQuery('');
    onClose();
    navigate(item.to);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-[14vh] backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div role="dialog" aria-label={t.shell.quickNav} className="w-full max-w-lg animate-fade-up overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              if (event.key === 'Enter' && results[0]) go(results[0]);
            }}
            placeholder={t.shell.typeToSearch}
            className="w-full bg-transparent py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto p-2">
          {results.length === 0 ? <li className="px-3 py-6 text-center text-sm text-slate-500">{t.common.noResult}</li> : null}
          {results.map((item) => (
            <li key={item.to}>
              <button type="button" onClick={() => go(item)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm text-slate-700 hover:bg-slate-100">
                <Icon name={item.icon} className="h-4 w-4 text-slate-500" />
                {navLabel(t, role, item.id)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const iconButton =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900';

export default function AppShell({ role }) {
  const { t, language, setLanguage, dir } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();
  const items = NAV_BY_ROLE[role];
  const [drawer, setDrawer] = useState(false);
  const [quick, setQuick] = useState(false);
  const bellTarget = items.find((item) => item.id === 'notifications')?.to;

  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuick((open) => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.getElementById('main-content')?.scrollTo?.({ top: 0 });
  }, [location.pathname]);

  const current = items.find((item) => location.pathname.startsWith(item.to));

  return (
    <div dir={dir} className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 lg:block">
        <SidebarContent role={role} items={items} />
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 start-0 w-72 max-w-[85%] animate-fade-up shadow-2xl">
            <SidebarContent role={role} items={items} onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button type="button" className={`${iconButton} lg:hidden`} onClick={() => setDrawer(true)} aria-label={t.common.menu}>
              <Icon name="menu" />
            </button>

            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{t.roles[role]}</div>
              <div className="truncate font-display text-base font-semibold text-slate-900">{current ? navLabel(t, role, current.id) : t.appName}</div>
            </div>

            <button
              type="button"
              onClick={() => setQuick(true)}
              className="ms-auto flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 transition hover:border-slate-300 sm:ms-6"
            >
              <Icon name="search" className="h-4 w-4" />
              <span className="flex-1 truncate text-start">{t.common.search}</span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-500 md:inline">Ctrl K</kbd>
            </button>

            <div className="flex items-center gap-2">
              {bellTarget ? <NotificationBell to={bellTarget} /> : null}
              <button type="button" className={iconButton} onClick={toggleTheme} aria-label={t.common.theme} title={theme === 'dark' ? t.common.light : t.common.dark}>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>
              <button type="button" className={`${iconButton} w-auto gap-1.5 px-2.5 text-xs font-semibold`} onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')} aria-label={t.common.language}>
                <Icon name="globe" className="h-4 w-4" />
                {language === 'fr' ? 'AR' : 'FR'}
              </button>
              <div className="ms-1 hidden items-center gap-2 border-s border-slate-200 ps-3 md:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700" aria-hidden="true">{initials(user?.name)}</div>
                <div className="max-w-[140px] leading-tight">
                  <div className="truncate text-sm font-medium text-slate-800">{user?.name || '—'}</div>
                  <div className="truncate text-xs text-slate-500">{user?.email || t.roles[role]}</div>
                </div>
              </div>
              <button type="button" className={iconButton} onClick={logout} aria-label={t.auth.logout} title={t.auth.logout}>
                <Icon name="logout" />
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1400px] animate-fade-up p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <QuickNav open={quick} onClose={() => setQuick(false)} items={items} role={role} />
    </div>
  );
}
