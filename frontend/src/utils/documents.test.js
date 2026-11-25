import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FILE_SIZE, describeDocumentError, formatFileSize, getVisibilityDisplay, validateUpload } from './documents.js';

test('formatFileSize gère octets, Ko, Mo et valeurs invalides', () => {
  assert.equal(formatFileSize(512), '512 o');
  assert.equal(formatFileSize(2048), '2,0 Ko');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5,0 Mo');
  assert.equal(formatFileSize(undefined), '—');
  assert.equal(formatFileSize(-1), '—');
});

test('validateUpload exige dossier et fichier', () => {
  assert.deepEqual(Object.keys(validateUpload({ caseId: '', file: null })).sort(), ['caseId', 'file']);
  assert.deepEqual(validateUpload({ caseId: 'c1', file: { size: 10 } }), {});
});

test('validateUpload refuse fichier vide et trop gros', () => {
  assert.match(validateUpload({ caseId: 'c', file: { size: 0 } }).file, /vide/);
  assert.match(validateUpload({ caseId: 'c', file: { size: MAX_FILE_SIZE + 1 } }).file, /dépasse/);
});

test('getVisibilityDisplay renvoie un repli pour une valeur inconnue', () => {
  assert.equal(getVisibilityDisplay('PRIVATE').tone, 'rose');
  assert.equal(getVisibilityDisplay('X').label, 'X');
});

test('describeDocumentError traduit les statuts HTTP courants', () => {
  assert.match(describeDocumentError({ status: 413 }), /volumineux/);
  assert.match(describeDocumentError({ status: 403 }), /droit/);
  assert.equal(describeDocumentError({ status: 500, message: 'boom' }), 'boom');
});
