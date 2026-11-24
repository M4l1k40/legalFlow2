import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedNextStatuses,
  describeHistoryEvent,
  describeStatusChangeError,
  sortEventsNewestFirst,
  validateNote
} from './cases.js';

test('un dossier ouvert peut passer à tous les statuts sauf lui-même et « archivé »', () => {
  assert.deepEqual(allowedNextStatuses('OPEN'), ['IN_PROGRESS', 'WAITING_CLIENT', 'COURT_PROCEEDING', 'CLOSED']);
});

test('un dossier clôturé peut être rouvert ou archivé', () => {
  const next = allowedNextStatuses('CLOSED');
  assert.ok(next.includes('ARCHIVED'));
  assert.ok(next.includes('IN_PROGRESS'));
  assert.ok(!next.includes('CLOSED'));
});

test('un dossier archivé ne peut plus changer de statut', () => {
  assert.deepEqual(allowedNextStatuses('ARCHIVED'), []);
  assert.deepEqual(allowedNextStatuses('INCONNU'), []);
});

test('la note est limitée à 1000 caractères', () => {
  assert.equal(validateNote(''), null);
  assert.equal(validateNote('a'.repeat(1000)), null);
  assert.match(validateNote('a'.repeat(1001)), /trop longue/);
});

test('l\'ouverture d\'un dossier est lisible', () => {
  assert.equal(describeHistoryEvent({ type: 'CASE_CREATED', description: 'Case created' }).title, 'Dossier ouvert');
});

test('un changement de statut affiche les libellés français et la note', () => {
  const line = describeHistoryEvent({ type: 'STATUS_CHANGED', description: 'OPEN -> IN_PROGRESS | Dossier pris en charge' });
  assert.equal(line.title, 'Statut modifié');
  assert.equal(line.detail, 'Ouvert → En cours');
  assert.equal(line.note, 'Dossier pris en charge');
});

test('un changement de statut sans note n\'a pas de note', () => {
  const line = describeHistoryEvent({ type: 'STATUS_CHANGED', description: 'CLOSED -> ARCHIVED' });
  assert.equal(line.detail, 'Clôturé → Archivé');
  assert.equal(line.note, '');
});

test('un événement inconnu garde sa description', () => {
  const line = describeHistoryEvent({ type: 'SOMETHING', description: 'Texte libre' });
  assert.equal(line.detail, 'Texte libre');
});

test('les événements sont triés du plus récent au plus ancien', () => {
  const sorted = sortEventsNewestFirst([
    { id: 'a', createdAt: '2026-11-10T10:00:00' },
    { id: 'b', createdAt: '2026-11-12T10:00:00' }
  ]);
  assert.deepEqual(sorted.map((event) => event.id), ['b', 'a']);
  assert.deepEqual(sortEventsNewestFirst(null), []);
});

test('les erreurs de changement de statut sont expliquées', () => {
  assert.match(describeStatusChangeError({ status: 409 }), /pas permis/);
  assert.match(describeStatusChangeError({ status: 404 }), /introuvable/);
  assert.equal(describeStatusChangeError({ status: 500, message: 'Boom' }), 'Boom');
});
