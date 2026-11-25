import test from 'node:test';
import assert from 'node:assert/strict';
import { lawyersInChargeOf, summarizeLawyers } from './officeLawyers.js';

const lawyers = [
  { id: 'l2', firstName: 'Zoé', lastName: 'Zahra', username: 'lawyer-z' },
  { id: 'l1', firstName: 'Amine', lastName: 'Alaoui', username: 'lawyer-a' }
];
const clients = [
  { id: 'c1', firstName: 'Client', lastName: 'A', lawyerIds: ['l1'] },
  { id: 'c2', firstName: 'Bia', lastName: 'B', lawyerIds: ['l1', 'l2'] },
  { id: 'c3', firstName: 'Sans', lastName: 'Avocat', lawyerIds: [] }
];
const cases = [
  { id: 'k1', lawyerId: 'l1', status: 'OPEN' },
  { id: 'k2', lawyerId: 'l1', status: 'CLOSED' },
  { id: 'k3', lawyerId: 'l2', status: 'IN_PROGRESS' }
];

test('les avocats sont triés par nom et comptent leurs clients et dossiers', () => {
  const rows = summarizeLawyers(lawyers, clients, cases);
  assert.deepEqual(rows.map((row) => row.id), ['l1', 'l2']);
  assert.equal(rows[0].clientCount, 2);
  assert.deepEqual(rows[0].clientNames, ['Bia B', 'Client A']);
  assert.equal(rows[0].activeCases, 1);
  assert.equal(rows[0].totalCases, 2);
  assert.equal(rows[1].clientCount, 1);
});

test('des listes absentes ne font pas planter le calcul', () => {
  assert.deepEqual(summarizeLawyers(null, null, null), []);
  assert.equal(summarizeLawyers(lawyers, undefined, undefined)[0].clientCount, 0);
});

test('un avocat sans nom affiche son identifiant de connexion', () => {
  const rows = summarizeLawyers([{ id: 'x', username: 'jdoe' }], [], []);
  assert.equal(rows[0].name, 'jdoe');
});

test('seuls les avocats en charge du client peuvent ouvrir un dossier pour lui', () => {
  assert.deepEqual(lawyersInChargeOf(clients[1], lawyers).map((l) => l.id), ['l2', 'l1']);
  assert.deepEqual(lawyersInChargeOf(clients[2], lawyers), []);
  assert.deepEqual(lawyersInChargeOf(null, lawyers), []);
});
