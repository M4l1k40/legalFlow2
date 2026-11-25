import assert from 'node:assert/strict';
import test from 'node:test';
import { translatePhrase } from './translate.js';
import ar from './phrases.ar.js';

test('le français est renvoyé tel quel', () => {
  assert.equal(translatePhrase('fr', 'Documents'), 'Documents');
});

test('une phrase connue est traduite en arabe', () => {
  assert.equal(translatePhrase('ar', 'Documents'), 'المستندات');
});

test('un texte inconnu ou non textuel reste inchangé', () => {
  assert.equal(translatePhrase('ar', 'Texte jamais traduit'), 'Texte jamais traduit');
  assert.equal(translatePhrase('ar', 42), 42);
  assert.equal(translatePhrase('de', 'Documents'), 'Documents');
});

test('un compteur entre parenthèses est conservé', () => {
  assert.equal(translatePhrase('ar', 'Équipe (3)'), 'الفريق (3)');
});

test('le dictionnaire n\'a ni valeur vide ni valeur identique à la clé', () => {
  for (const [key, value] of Object.entries(ar)) {
    assert.ok(value && value.trim(), `valeur vide pour « ${key} »`);
    assert.notEqual(value, key);
  }
});
