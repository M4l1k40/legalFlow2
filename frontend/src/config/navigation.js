// Navigation par rôle. `id` sert de clé de traduction (t.nav[id], surchargée par t.navClient[id] pour le client).
const item = (base, id, icon, group = 'work') => ({ to: `${base}/${id === 'invoices' ? 'invoices' : id}`, id, icon, group });

const lawyer = (base = '/lawyer') => [
  item(base, 'dashboard', 'dashboard', 'overview'),
  item(base, 'clients', 'users'),
  item(base, 'cases', 'briefcase'),
  item(base, 'judicial', 'scale'),
  item(base, 'deadlines', 'clock'),
  item(base, 'appointments', 'calendar'),
  item(base, 'documents', 'file'),
  item(base, 'consultations', 'chat'),
  item(base, 'invoices', 'receipt', 'finance'),
  item(base, 'notifications', 'bell', 'account'),
  item(base, 'settings', 'settings', 'account')
];

export const NAV_BY_ROLE = {
  lawyer: lawyer('/lawyer'),
  client: [
    item('/client', 'dashboard', 'dashboard', 'overview'),
    item('/client', 'cases', 'briefcase'),
    item('/client', 'judicial', 'scale'),
    item('/client', 'documents', 'file'),
    item('/client', 'appointments', 'calendar'),
    item('/client', 'consultations', 'chat'),
    item('/client', 'payments', 'receipt', 'finance'),
    item('/client', 'notifications', 'bell', 'account'),
    item('/client', 'profile', 'users', 'account'),
    item('/client', 'settings', 'settings', 'account')
  ],
  secretary: [
    item('/secretary', 'dashboard', 'dashboard', 'overview'),
    item('/secretary', 'clients', 'users'),
    item('/secretary', 'lawyers', 'shield'),
    item('/secretary', 'cases', 'briefcase'),
    item('/secretary', 'appointments', 'calendar'),
    item('/secretary', 'documents', 'file'),
    item('/secretary', 'consultations', 'chat'),
    item('/secretary', 'payments', 'receipt', 'finance'),
    item('/secretary', 'notifications', 'bell', 'account'),
    item('/secretary', 'settings', 'settings', 'account')
  ],
  admin: [
    item('/admin', 'dashboard', 'dashboard', 'overview'),
    item('/admin', 'clients', 'users'),
    item('/admin', 'cases', 'briefcase'),
    item('/admin', 'consultations', 'chat'),
    item('/admin', 'billing', 'receipt', 'finance'),
    item('/admin', 'users', 'shield', 'admin'),
    item('/admin', 'lawyers', 'users', 'admin'),
    item('/admin', 'secretaries', 'users', 'admin'),
    item('/admin', 'settings', 'settings', 'account')
  ]
};

export function navLabel(t, role, id) {
  return (role === 'client' && t.navClient?.[id]) || t.nav?.[id] || id;
}
