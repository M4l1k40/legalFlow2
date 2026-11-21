// Logique du formulaire « Mon profil » (espace client) : valeurs initiales, validation, payload, messages d'erreur.

const PHONE_PATTERN = /^[+()\d][\d\s().-]{4,28}$/;

export function profileToForm(client) {
  return {
    firstName: client?.firstName ?? '',
    lastName: client?.lastName ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? ''
  };
}

export function validateProfile(form) {
  const errors = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'Le prénom est obligatoire.';
  } else if (form.firstName.trim().length > 100) {
    errors.firstName = 'Le prénom ne doit pas dépasser 100 caractères.';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Le nom est obligatoire.';
  } else if (form.lastName.trim().length > 100) {
    errors.lastName = 'Le nom ne doit pas dépasser 100 caractères.';
  }

  if (form.phone.trim() && !PHONE_PATTERN.test(form.phone.trim())) {
    errors.phone = 'Numéro de téléphone invalide (chiffres, espaces, +, -, ( ) uniquement).';
  }

  if (form.address.trim().length > 500) {
    errors.address = 'L’adresse ne doit pas dépasser 500 caractères.';
  }

  return errors;
}

// Seuls ces quatre champs sont envoyés : l'email, le cabinet et les avocats ne sont pas modifiables par le client.
export function buildProfilePayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phone: form.phone.trim(),
    address: form.address.trim()
  };
}

export function describeProfileError(error) {
  if (error?.status === 400) {
    return 'Certaines informations sont invalides. Vérifiez le formulaire.';
  }
  if (error?.status === 403) {
    return 'Vous n’avez pas le droit de modifier ce profil.';
  }
  if (error?.status === 404) {
    return 'Aucune fiche client n’est associée à votre compte.';
  }
  return error?.message || 'La mise à jour du profil a échoué.';
}
