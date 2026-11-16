import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_FILE_BYTES,
  describeDocumentError,
  fileExtension,
  formatFileSize,
  validateUploadFile
} from './documents.js';

test('un fichier PDF valide est accepté', () => {
  assert.equal(validateUploadFile({ name: 'contrat.PDF', size: 1200 }), null);
});

test('aucun fichier, fichier vide et fichier trop gros sont refusés', () => {
  assert.equal(validateUploadFile(null), 'Choisissez un fichier.');
  assert.equal(validateUploadFile({ name: 'a.pdf', size: 0 }), 'Le fichier est vide.');
  assert.equal(validateUploadFile({ name: 'a.pdf', size: MAX_FILE_BYTES + 1 }), 'Le fichier dépasse 10 Mo.');
});

test('les types exécutables ou sans extension sont refusés', () => {
  assert.match(validateUploadFile({ name: 'virus.exe', size: 10 }), /non accepté/);
  assert.match(validateUploadFile({ name: 'page.html', size: 10 }), /non accepté/);
  assert.match(validateUploadFile({ name: 'sans-extension', size: 10 }), /non accepté/);
});

test('un nom de plus de 255 caractères est refusé', () => {
  assert.match(validateUploadFile({ name: `${'a'.repeat(260)}.pdf`, size: 10 }), /trop long/);
});

test('l\'extension est lue en minuscules', () => {
  assert.equal(fileExtension('Photo.JPG'), 'jpg');
  assert.equal(fileExtension('archive'), '');
});

test('la taille est affichée en o, Ko ou Mo', () => {
  assert.equal(formatFileSize(512), '512 o');
  assert.equal(formatFileSize(43008), '42 Ko');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 Mo');
  assert.equal(formatFileSize(0), '—');
});

test('les erreurs de document sont expliquées en français', () => {
  assert.match(describeDocumentError({ status: 403 }), /non autorisée/);
  assert.match(describeDocumentError({ status: 404 }, { download: true }), /Aucun fichier/);
  assert.match(describeDocumentError({ status: 413 }), /10 Mo/);
  assert.equal(describeDocumentError({ status: 500, message: 'Boom' }), 'Boom');
});
