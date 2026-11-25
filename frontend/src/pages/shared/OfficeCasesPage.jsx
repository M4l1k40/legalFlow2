import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import Banner from '../../components/common/Banner';
import FormField, { inputClass } from '../../components/common/FormField';
import { primaryButton, secondaryButton } from '../../components/common/buttonStyles';
import useApi from '../../hooks/useApi';
import { api } from '../../services/api';
import { STATUS_OPTIONS, formatDate, getStatusDisplay, sortByCreatedAtDesc } from '../../constants/caseStatus';

const reference = () => `CASE-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
const blank = () => ({ clientId: '', lawyerId: '', reference: reference(), title: '', description: '', status: 'OPEN' });

function describeError(error) {
  if (error.status === 400) return 'Données invalides (client, avocat, référence ou titre).';
  if (error.status === 403) return "Vous n'avez pas le droit de créer un dossier.";
  if (error.status === 404 || error.status === 422) return 'Client introuvable pour ce cabinet.';
  if (error.status === 409) return error.message || 'Cette référence existe déjà.';
  return error.message || 'Impossible de créer le dossier.';
}

/** Dossiers vus par le secrétariat et l'administration : l'avocat responsable est choisi dans l'annuaire du cabinet. */
export default function OfficeCasesPage({ eyebrow }) {
  const casesApi = useApi('/api/cases');
  const clientsApi = useApi('/api/clients');
  const lawyersApi = useApi('/api/users/lawyers');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const clients = useMemo(() => (Array.isArray(clientsApi.data) ? clientsApi.data : []), [clientsApi.data]);
  const lawyers = useMemo(() => (Array.isArray(lawyersApi.data) ? lawyersApi.data : []), [lawyersApi.data]);
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, `${c.firstName} ${c.lastName}`])), [clients]);
  const lawyerName = useMemo(() => new Map(lawyers.map((l) => [l.id, `${l.firstName} ${l.lastName}`])), [lawyers]);
  const cases = useMemo(() => {
    const list = sortByCreatedAtDesc(Array.isArray(casesApi.data) ? casesApi.data : []);
    return filter === 'ALL' ? list : list.filter((item) => item.status === filter);
  }, [casesApi.data, filter]);

  const set = (name, value) => { setForm((p) => ({ ...p, [name]: value })); setErrors((p) => ({ ...p, [name]: undefined })); };

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (!form.clientId) found.clientId = 'Choisissez un client.';
    if (!form.lawyerId) found.lawyerId = 'Choisissez un avocat.';
    if (!form.reference.trim()) found.reference = 'La référence est obligatoire.';
    if (!form.title.trim()) found.title = 'Le titre est obligatoire.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setSubmitting(true);
    try {
      const created = await api.post('/api/cases', { ...form, reference: form.reference.trim(), title: form.title.trim(), description: form.description.trim() || null });
      setFeedback({ type: 'success', message: `Dossier « ${created.title} » (${created.reference}) créé.` });
      setOpen(false);
      casesApi.refetch();
    } catch (error) {
      setFeedback({ type: 'error', message: describeError(error) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title="Dossiers"
        description="Tous les dossiers du cabinet. Ouvrez un dossier et confiez-le à un avocat."
        action={!open ? <button type="button" className={primaryButton} onClick={() => { setForm(blank()); setOpen(true); setFeedback(null); }}>Nouveau dossier</button> : null}
      />
      {feedback ? <Banner type={feedback.type} onClose={() => setFeedback(null)}>{feedback.message}</Banner> : null}

      {open ? (
        <SectionCard title="Nouveau dossier">
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Client" htmlFor="oc-client" required error={errors.clientId}>
                <select id="oc-client" className={inputClass} value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </FormField>
              <FormField label="Avocat responsable" htmlFor="oc-lawyer" required error={errors.lawyerId}>
                <select id="oc-lawyer" className={inputClass} value={form.lawyerId} onChange={(e) => set('lawyerId', e.target.value)}>
                  <option value="">— Choisir —</option>
                  {lawyers.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>)}
                </select>
              </FormField>
              <FormField label="Référence" htmlFor="oc-ref" required error={errors.reference}>
                <input id="oc-ref" className={inputClass} value={form.reference} onChange={(e) => set('reference', e.target.value)} />
              </FormField>
              <FormField label="Titre" htmlFor="oc-title" required error={errors.title}>
                <input id="oc-title" className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
              </FormField>
              <FormField label="Statut" htmlFor="oc-status">
                <select id="oc-status" className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Description" htmlFor="oc-desc">
              <textarea id="oc-desc" rows={3} maxLength={2000} className={inputClass} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormField>
            <div className="flex gap-3">
              <button type="submit" className={primaryButton} disabled={submitting}>{submitting ? 'Enregistrement…' : 'Créer le dossier'}</button>
              <button type="button" className={secondaryButton} onClick={() => setOpen(false)}>Annuler</button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Liste des dossiers${Array.isArray(casesApi.data) ? ` (${casesApi.data.length})` : ''}`}
        action={
          <select aria-label="Filtrer par statut" className={`${inputClass} max-w-[220px]`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">Tous les statuts</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        }
      >
        <AsyncState loading={casesApi.loading} error={casesApi.error} onRetry={casesApi.refetch} isEmpty={cases.length === 0} emptyMessage="Aucun dossier.">
          <div className="space-y-3">
            {cases.map((item) => {
              const status = getStatusDisplay(item.status);
              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800">{item.title}</div>
                    <div className="text-sm text-slate-500">
                      Réf. {item.reference} · Client : {clientName.get(item.clientId) || 'Inconnu'} · Avocat : {lawyerName.get(item.lawyerId) || 'Inconnu'} · {formatDate(item.createdAt)}
                    </div>
                  </div>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
              );
            })}
          </div>
        </AsyncState>
      </SectionCard>
    </div>
  );
}
