import arPhrases from './phrases.ar.js';

const PHRASES = { ar: arPhrases };

/**
 * Traduit un texte d'interface français vers la langue demandée.
 * - français ou texte inconnu : renvoyé tel quel ;
 * - un suffixe de compteur « (12) » est conservé : « Équipe (3) » → « الفريق (3) ».
 */
export function translatePhrase(language, text) {
  if (typeof text !== 'string' || language === 'fr') return text;
  const table = PHRASES[language];
  if (!table) return text;
  if (Object.hasOwn(table, text)) return table[text];
  const counted = /^(.*?)(\s*\(\d+\))$/.exec(text);
  if (counted && Object.hasOwn(table, counted[1])) return `${table[counted[1]]}${counted[2]}`;
  return text;
}
