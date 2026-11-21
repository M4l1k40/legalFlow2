import { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import AsyncState from '../../components/common/AsyncState';
import FormField, { inputClass } from '../../components/common/FormField';
import { primaryButton, secondaryButton } from '../../components/common/buttonStyles';
import useApi from '../../hooks/useApi';
import useAction from '../../hooks/useAction';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  buildProfilePayload,
  describeProfileError,
  profileToForm,
  validateProfile
} from '../../utils/clientProfile';

const LANGUAGE_LABELS = {
  fr: 'Français',
  ar: 'العربية'
};

function formatDate(value, language) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 break-words text-lg font-semibold text-slate-900">{value || '—'}</div>
    </div>
  );
}

export default function ClientProfilePage() {
  // Fiche du client connecté : l'identité vient du JWT, jamais du frontend
  const { data: client, loading, error, refetch } = useApi('/api/clients/me');
  const { busyKey, feedback, run, clearFeedback } = useAction();
  const { language } = useLanguage();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(profileToForm(null));
  const [errors, setErrors] = useState({});

  const fullName = client ? `${client.firstName ?? ''} ${client.lastName ?? ''}`.trim() : '';
  const saving = busyKey === 'save-profile';

  function startEditing() {
    clearFeedback();
    setForm(profileToForm(client));
    setErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setErrors({});
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationErrors = validateProfile(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const saved = await run(
      'save-profile',
      () => api.put('/api/clients/me', buildProfilePayload(form)),
      'Votre profil a été mis à jour.',
      describeProfileError
    );

    if (saved) {
      setEditing(false);
      refetch();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mon profil"
        title="Informations client"
        description="Données personnelles et paramètres du compte."
      />

      {feedback ? (
        <div
          role="status"
          className={`rounded-xl border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <SectionCard title="Profil">
        <AsyncState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={!client}
          emptyMessage="Aucune fiche client n’est associée à votre compte."
          loadingMessage="Chargement de votre profil…"
        >
          {client && editing && (
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2" noValidate>
              <FormField label="Prénom" htmlFor="profile-first-name" error={errors.firstName} required>
                <input
                  id="profile-first-name"
                  className={inputClass}
                  value={form.firstName}
                  maxLength={100}
                  autoComplete="given-name"
                  onChange={(event) => updateField('firstName', event.target.value)}
                />
              </FormField>

              <FormField label="Nom" htmlFor="profile-last-name" error={errors.lastName} required>
                <input
                  id="profile-last-name"
                  className={inputClass}
                  value={form.lastName}
                  maxLength={100}
                  autoComplete="family-name"
                  onChange={(event) => updateField('lastName', event.target.value)}
                />
              </FormField>

              <FormField
                label="Email"
                htmlFor="profile-email"
                hint="L’email sert à vous connecter et à recevoir vos notifications : contactez le cabinet pour le modifier."
              >
                <input id="profile-email" className={inputClass} value={client.email ?? ''} disabled readOnly />
              </FormField>

              <FormField label="Téléphone" htmlFor="profile-phone" error={errors.phone}>
                <input
                  id="profile-phone"
                  type="tel"
                  className={inputClass}
                  value={form.phone}
                  maxLength={30}
                  autoComplete="tel"
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </FormField>

              <div className="md:col-span-2">
                <FormField label="Adresse" htmlFor="profile-address" error={errors.address}>
                  <textarea
                    id="profile-address"
                    rows={3}
                    className={inputClass}
                    value={form.address}
                    maxLength={500}
                    autoComplete="street-address"
                    onChange={(event) => updateField('address', event.target.value)}
                  />
                </FormField>
              </div>

              <div className="flex gap-3 md:col-span-2">
                <button type="submit" className={primaryButton} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className={secondaryButton} disabled={saving} onClick={cancelEditing}>
                  Annuler
                </button>
              </div>
            </form>
          )}

          {client && !editing && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ProfileField label="Nom" value={fullName} />
                <ProfileField label="Email" value={client.email} />
                <ProfileField label="Téléphone" value={client.phone} />
                <ProfileField label="Adresse" value={client.address} />
                <ProfileField label="Langue de l’interface" value={LANGUAGE_LABELS[language] ?? language} />
                <ProfileField label="Client depuis le" value={formatDate(client.createdAt, language)} />
              </div>
              <button type="button" className={secondaryButton} onClick={startEditing}>
                Modifier mon profil
              </button>
            </div>
          )}
        </AsyncState>
      </SectionCard>
    </div>
  );
}
