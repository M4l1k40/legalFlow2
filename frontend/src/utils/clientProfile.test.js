import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfilePayload, describeProfileError, profileToForm, validateProfile } from './clientProfile.js';

const validForm = { firstName: 'Sophie', lastName: 'Martin', phone: '+33 6 12 45 98 75', address: '12 rue des Lilas' };

test('profileToForm remplace les valeurs absentes par des chaînes vides', () => {
  assert.deepEqual(profileToForm({ firstName: 'Sophie', lastName: 'Martin', phone: null }), {
    firstName: 'Sophie',
    lastName: 'Martin',
    phone: '',
    address: ''
  });
  assert.deepEqual(profileToForm(null), { firstName: '', lastName: '', phone: '', address: '' });
});

test('validateProfile accepte un profil valide et un téléphone ou une adresse vides', () => {
  assert.deepEqual(validateProfile(validForm), {});
  assert.deepEqual(validateProfile({ ...validForm, phone: '', address: '' }), {});
});

test('validateProfile exige un prénom et un nom non vides', () => {
  const errors = validateProfile({ ...validForm, firstName: '   ', lastName: '' });
  assert.ok(errors.firstName);
  assert.ok(errors.lastName);
});

test('validateProfile refuse un téléphone invalide ou des champs trop longs', () => {
  assert.ok(validateProfile({ ...validForm, phone: 'abc' }).phone);
  assert.ok(validateProfile({ ...validForm, address: 'x'.repeat(501) }).address);
  assert.ok(validateProfile({ ...validForm, firstName: 'x'.repeat(101) }).firstName);
});

test('buildProfilePayload nettoie les espaces et n’envoie jamais l’email', () => {
  const payload = buildProfilePayload({ ...validForm, firstName: '  Sophie ', email: 'x@y.z' });
  assert.deepEqual(payload, {
    firstName: 'Sophie',
    lastName: 'Martin',
    phone: '+33 6 12 45 98 75',
    address: '12 rue des Lilas'
  });
  assert.equal('email' in payload, false);
});

test('describeProfileError donne un message adapté au statut HTTP', () => {
  assert.match(describeProfileError({ status: 400 }), /invalides/);
  assert.match(describeProfileError({ status: 403 }), /droit/);
  assert.match(describeProfileError({ status: 404 }), /fiche client/);
  assert.equal(describeProfileError({ status: 500, message: 'Boom' }), 'Boom');
});
