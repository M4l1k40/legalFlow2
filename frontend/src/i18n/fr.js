export default {
  appName: 'LegalFlow',
  tagline: 'La plateforme de gestion des cabinets d’avocats',
  nav: {
    dashboard: 'Tableau de bord', clients: 'Clients', cases: 'Dossiers', judicial: 'Judiciaire',
    deadlines: 'Échéances', appointments: 'Rendez-vous', documents: 'Documents', notifications: 'Notifications',
    invoices: 'Factures', billing: 'Facturation', consultations: 'Consultations', lawyers: 'Avocats',
    secretaries: 'Secrétaires', users: 'Utilisateurs', payments: 'Paiements', profile: 'Mon profil', settings: 'Paramètres'
  },
  navClient: {
    cases: 'Mes dossiers', documents: 'Mes documents', judicial: 'Mes procédures', payments: 'Mes paiements',
    appointments: 'Mes rendez-vous', consultations: 'Mes consultations'
  },
  navGroups: { overview: 'Vue d’ensemble', work: 'Activité', finance: 'Finance', admin: 'Administration', account: 'Compte' },
  roles: { admin: 'Administrateur', lawyer: 'Avocat', secretary: 'Secrétaire', client: 'Client' },
  common: {
    search: 'Aller à…', save: 'Enregistrer', cancel: 'Annuler', viewAll: 'Voir tout', status: 'Statut',
    language: 'Langue', dashboard: 'Tableau de bord', theme: 'Thème', light: 'Clair', dark: 'Sombre',
    loading: 'Chargement…', menu: 'Menu', close: 'Fermer', noResult: 'Aucun résultat', firm: 'Cabinet'
  },
  shell: { quickNav: 'Navigation rapide', typeToSearch: 'Tapez le nom d’une page…', account: 'Mon compte' },
  auth: {
    loginTitle: 'Connexion', loginSubtitle: 'Accédez à votre espace juridique', continue: 'Se connecter',
    logout: 'Déconnexion', secure: 'Connexion sécurisée par Keycloak (OpenID Connect)',
    noRole: 'Votre compte est authentifié mais ne possède aucun rôle LegalFlow reconnu.'
  },
  login: {
    heroTitle: 'Chaque dossier. Chaque délai. Chaque cabinet — isolé et protégé.',
    heroText: 'Clients, procédures judiciaires, échéances, documents et facturation réunis dans une plateforme multi-cabinets sécurisée.',
    f1: 'Isolation stricte des données par cabinet', f2: 'Rappels d’échéances J-7, J-3 et J-1',
    f3: 'Espaces dédiés : avocat, secrétaire, client, administrateur'
  },
  notFound: { title: 'Page introuvable', text: 'Cette page n’existe pas ou a été déplacée.', back: 'Retour à l’accueil' },
  settings: {
    title: 'Paramètres', subtitle: 'Votre compte, votre session et vos préférences d’affichage.',
    account: 'Compte', session: 'Session', display: 'Affichage', firmId: 'Identifiant du cabinet', roles: 'Rôles',
    name: 'Nom', email: 'E-mail', username: 'Identifiant', expires: 'Expiration du jeton'
  }
};
