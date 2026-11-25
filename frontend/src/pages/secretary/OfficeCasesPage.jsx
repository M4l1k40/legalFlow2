import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import FormField, { inputClass } from '../../components/common/FormField';
import { primaryButton, secondaryButton } from '../../components/common/buttonStyles';
import CaseDetailPanel from '../../components/cases/CaseDetailPanel';
import useApi from '../../hooks/useApi';
import { api } from '../../services/api';
import { STATUS_OPTIONS, formatDate, getStatusDisplay, sortByCreatedAtDesc } from '../../constants/caseStatus';
import { lawyersInChargeOf } from '../../utils/officeLawyers';

function generateReference() {
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `CASE-${new Date().getFullYear()}-${suffix}`;
}

function emptyForm() {
  return { clientId: '', lawyerId: '', reference: generateReference(), title: '', description: '' };
}

function validate(form) {
  const errors = {};
  if (!form.clientId) errors.clientId = 'Choisissez un client.';
  if (!form.lawyerId) errors.lawyerId = 'Choisissez l’avocat responsable.';
  if (!form.reference.trim()) errors.reference = 'La référence est obligatoire.';
  if (!form.title.trim()) errors.title = 'Le titre est obligatoire.';
  return errors;
}

function describeSubmitError(error) {
  if (error.status === 400) return 'Les données saisies sont invalides (client, avocat, référence ou titre).';
  if (error.status === 403) return 'Vous n’avez pas le droit de créer un dossier.';
  if (error.status === 404) return 'Client introuvable pour ce cabinet.';
  if (error.status === 409) return error.message || 'Cette référence existe déjà.';
  return error.message || 'Impossible de créer le dossier.';
}

function personName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || person?.username || 'Inconnu';
}

export default function OfficeCasesPage() {
  const casesApi = useApi('/api/cases');
  const clientsApi = useApi('/api/clients');
  const lawyersApi = useApi('/api/users/lawyers');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);

  const cases = useMemo(() => sortByCreatedAtDesc(Array.isArray(casesApi.data) ? casesApi.data : []), [casesApi.data]);
  const clients = useMemo(() => (Array.isArray(clientsApi.data) ? clientsApi.data : []), [clientsApi.data]);
  const lawyers = useMemo(() => (Array.isArray(lawyersApi.data) ? lawyersApi.data : []), [lawyersApi.data]);

  const clientNames = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, personName(client)])), [clients]);
  const lawyerNames = useMemo(() => Object.fromEntries(lawyers.map((lawyer) => [lawyer.id, personName(lawyer)])), [lawyers]);
  const filtered = statusFilter === 'ALL' ? cases : cases.filter((item) => item.status === statusFilter);

  const selectedClient = clients.find((client) => client.id === form.clientId);
  const eligibleLawyers = lawyersInChargeOf(selectedClient, lawyers);

  function updateField(field, value) {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      // Changer de client change la liste des avocats possibles : on garde le choix seulement s'il reste valide.
      if (field === 'clientId') {
        const allowed = lawyersInChargeOf(clients.find((client) => client.id === value), lawyers);
        next.lawyerId = allowed.length === 1 ? allowed[0].id : allowed.some((lawyer) => lawyer.id === previous.lawyerId) ? previous.lawyerId : '';
      }
      return next;
    });
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function openForm() {
    setForm(emptyForm());
    setFieldErrors({});
    setSubmitError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setSubmitError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      // Le serveur vérifie que l'avocat choisi est bien en charge de ce client.
      const created = await api.post('/api/cases', {
        clientId: form.clientId,
        lawyerId: form.lawyerId,
        reference: form.reference.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: 'OPEN'
      });
      closeForm();
      setSuccess(`Dossier « ${created.title} » (${created.reference}) créé avec succès.`);
      casesApi.refetch();
    } catch (requestError) {
      setSubmitError(describeSubmitError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Dossiers du cabinet"
        description="Suivez tous les dossiers du cabinet et ouvrez-en de nouveaux pour un avocat."
        action={!showForm ? <button type="button" className={primaryButton} onClick={openForm}>Nouveau dossier</button> : null}
      />

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      {showForm ? (
        <SectionCard title="Nouveau dossier">
          {!clientsApi.loading && clients.length === 0 ? (
            <p className="text-sm text-slate-600">
              Aucun client n’existe encore. Créez d’abord un client dans{' '}
              <Link to="/secretary/clients" className="font-medium text-slate-900 underline">Clients</Link>.
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Client" htmlFor="officeCaseClient" required error={fieldErrors.clientId}>
                  <select id="officeCaseClient" className={inputClass} value={form.clientId} onChange={(event) => updateField('clientId', event.target.value)} disabled={submitting}>
                    <option value="">— Choisir un client —</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{personName(client)} ({client.email})</option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Avocat responsable"
                  htmlFor="officeCaseLawyer"
                  required
                  error={fieldErrors.lawyerId}
                  hint={selectedClient && eligibleLawyers.length === 0 ? 'Ce client n’a pas d’avocat en charge : assignez-en un dans Clients.' : 'Parmi les avocats en charge du client.'}
                >
                  <select id="officeCaseLawyer" className={inputClass} value={form.lawyerId} onChange={(event) => updateField('lawyerId', event.target.value)} disabled={submitting || !selectedClient}>
                    <option value="">— Choisir un avocat —</option>
                    {eligibleLawyers.map((lawyer) => (
                      <option key={lawyer.id} value={lawyer.id}>{personName(lawyer)}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Référence" htmlFor="officeCaseReference" required error={fieldErrors.reference}>
                  <input id="officeCaseReference" className={inputClass} value={form.reference} onChange={(event) => updateField('reference', event.target.value)} disabled={submitting} />
                </FormField>
                <FormField label="Titre" htmlFor="officeCaseTitle" required error={fieldErrors.title}>
                  <input id="officeCaseTitle" className={inputClass} value={form.title} onChange={(event) => updateField('title', event.target.value)} disabled={submitting} />
                </FormField>
              </div>
              <FormField label="Description" htmlFor="officeCaseDescription" hint="2000 caractères maximum.">
                <textarea id="officeCaseDescription" rows={3} maxLength={2000} className={inputClass} value={form.description} onChange={(event) => updateField('description', event.target.value)} disabled={submitting} />
              </FormField>
              {submitError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{submitError}</div>
              ) : null}
              <div className="flex gap-3">
                <button type="submit" className={primaryButton} disabled={submitting}>{submitting ? 'Création…' : 'Créer le dossier'}</button>
                <button type="button" className={secondaryButton} onClick={closeForm} disabled={submitting}>Annuler</button>
              </div>
            </form>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Liste des dossiers (${filtered.length})`}
        action={
          <select className={`${inputClass} max-w-[220px]`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrer par statut">
            <option value="ALL">Tous les statuts</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
      >
        <AsyncState
          loading={casesApi.loading && !casesApi.data}
          error={casesApi.error}
          onRetry={casesApi.refetch}
          isEmpty={filtered.length === 0}
          emptyMessage="Aucun dossier pour ce filtre."
          loadingMessage="Chargement des dossiers…"
        >
          <div className="space-y-3">
            {filtered.map((item) => {
              const status = getStatusDisplay(item.status);
              const expanded = expandedId === item.id;
              return (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{item.title}</div>
                      <div className="text-sm text-slate-500">
                        Réf. {item.reference} · Client : {clientNames[item.clientId] || 'Inconnu'} · Avocat : {lawyerNames[item.lawyerId] || 'Inconnu'} · Ouvert le {formatDate(item.createdAt)}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      <button type="button" className={secondaryButton} onClick={() => setExpandedId(expanded ? null : item.id)}>
                        {expanded ? 'Masquer' : 'Détails'}
                      </button>
                    </div>
                  </div>
                  {expanded ? (
                    <CaseDetailPanel
                      legalCase={item}
                      clientName={clientNames[item.clientId]}
                      lawyerName={lawyerNames[item.lawyerId]}
                      canChangeStatus={false}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </AsyncState>
      </SectionCard>
    </div>
  );
}
