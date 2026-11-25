export default {
  appName: 'LegalFlow',
  tagline: 'منصة إدارة مكاتب المحاماة',
  nav: {
    dashboard: 'لوحة التحكم', clients: 'العملاء', cases: 'الملفات', judicial: 'القضاء',
    deadlines: 'الآجال', appointments: 'المواعيد', documents: 'المستندات', notifications: 'الإشعارات',
    invoices: 'الفواتير', billing: 'الفوترة', consultations: 'الاستشارات', lawyers: 'المحامون',
    secretaries: 'السكرتارية', users: 'المستخدمون', payments: 'المدفوعات', profile: 'ملفي الشخصي', settings: 'الإعدادات'
  },
  navClient: {
    cases: 'ملفاتي', documents: 'مستنداتي', judicial: 'مساطري', payments: 'مدفوعاتي',
    appointments: 'مواعيدي', consultations: 'استشاراتي'
  },
  navGroups: { overview: 'نظرة عامة', work: 'النشاط', finance: 'المالية', admin: 'الإدارة', account: 'الحساب' },
  roles: { admin: 'مدير', lawyer: 'محامٍ', secretary: 'سكرتير', client: 'عميل' },
  common: {
    search: 'انتقل إلى…', save: 'حفظ', cancel: 'إلغاء', viewAll: 'عرض الكل', status: 'الحالة',
    language: 'اللغة', dashboard: 'لوحة التحكم', theme: 'المظهر', light: 'فاتح', dark: 'داكن',
    loading: 'جارٍ التحميل…', menu: 'القائمة', close: 'إغلاق', noResult: 'لا نتائج', firm: 'المكتب'
  },
  shell: { quickNav: 'تنقل سريع', typeToSearch: 'اكتب اسم الصفحة…', account: 'حسابي' },
  auth: {
    loginTitle: 'تسجيل الدخول', loginSubtitle: 'ادخل إلى فضائك القانوني', continue: 'تسجيل الدخول',
    logout: 'تسجيل الخروج', secure: 'اتصال آمن عبر Keycloak (OpenID Connect)',
    noRole: 'حسابك موثّق لكنه لا يملك أي دور معروف في LegalFlow.'
  },
  login: {
    heroTitle: 'كل ملف. كل أجل. كل مكتب — معزول ومحمي.',
    heroText: 'العملاء والمساطر القضائية والآجال والمستندات والفوترة في منصة آمنة متعددة المكاتب.',
    f1: 'عزل صارم للبيانات بين المكاتب', f2: 'تذكيرات بالآجال قبل 7 و3 و1 أيام',
    f3: 'فضاءات مخصصة: محامٍ، سكرتير، عميل، مدير'
  },
  notFound: { title: 'الصفحة غير موجودة', text: 'هذه الصفحة غير موجودة أو تم نقلها.', back: 'العودة إلى الرئيسية' },
  settings: {
    title: 'الإعدادات', subtitle: 'حسابك وجلستك وتفضيلات العرض.',
    account: 'الحساب', session: 'الجلسة', display: 'العرض', firmId: 'معرّف المكتب', roles: 'الأدوار',
    name: 'الاسم', email: 'البريد الإلكتروني', username: 'اسم المستخدم', expires: 'انتهاء الرمز'
  }
};
