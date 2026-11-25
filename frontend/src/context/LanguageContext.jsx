import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getDirection, translations } from '../i18n';
import { translatePhrase } from '../i18n/translate';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('fr');

  useEffect(() => {
    const dir = getDirection(language);
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  // tr(texte français) : traduit un libellé de page métier (voir i18n/phrases.ar.js) ; inconnu = inchangé.
  const tr = useCallback((text) => translatePhrase(language, text), [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: translations[language],
    dir: getDirection(language),
    tr,
  }), [language, tr]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }

  return context;
}
