import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import { dangerButton, secondaryButton } from '../../components/common/buttonStyles';
import useApi from '../../hooks/useApi';
import useAction from '../../hooks/useAction';
import { api } from '../../services/api';
import {
  describeDelay,
  describeInvoiceError,
  formatDay,
  formatMoney,
  groupInvoices,
  invoiceActions,
  invoiceTotals
} from '../../utils/invoices';

const TABS = [
  { key: 'late', label: 'En retard', tone: 'rose', badge: 'En retard' },
  { key: 'open', label: 'À régler', tone: 'blue', badge: 'Envoyée' },
  { key: 'draft', label: 'Brouillons', tone: 'amber', badge: 'Brouillon' },
  { key: 'paid', label: 'Payées', tone: 'emerald', badge: 'Payée' },
  { key: 'cancelled', label: 'Annulées', tone: 'slate', badge: 'Annulée' }
];

function personName(person) {
  return `${person?.firstName || ''} ${person?.lastName || ''}`.trim() || 'Inconnu';
}

export default function OfficePaymentsPage() {
  const invoicesApi = useApi('/api/invoices');
  const clientsApi = useApi('/api/clients');
  const casesApi = useApi('/api/cases');
  const { busyKey, feedback, run } = useAction();
  const [tab, setTab] = useState(null);

  const now = useMemo(() => new Date(), []);
  const invoices = useMemo(() => (Array.isArray(invoicesApi.data) ? invoicesApi.data : []), [invoicesApi.data]);
  const groups = useMemo(() => groupInvoices(invoices, now), [invoices, now]);
  const totals = useMemo(() => invoiceTotals(invoices, now), [invoices, now]);
  const clientNames = useMemo(
    () => Object.fromEntries((Array.isArray(clientsApi.data) ? clientsApi.data : []).map((client) => [client.id, personName(client)])),
    [clientsApi.data]
  );
  const caseById = useMemo(
    () => Object.fromEntries((Array.isArray(casesApi.data) ? casesApi.data : []).map((item) => [item.id, item])),
    [casesApi.data]
  );

  const activeTab = tab || (groups.late.length > 0 ? 'late' : 'open');
  const list = groups[activeTab] || [];
  const tabInfo = TABS.find((item) => item.key === activeTab) || TABS[1];

  async function changeStatus(invoice, status, message, confirmation) {
    if (confirmation && !window.confirm(confirmation)) return;
    const ok = await run(
      `status-${invoice.id}`,
      () => api.patch(`/api/invoices/${invoice.id}/status?status=${status}`),
      message,
      describeInvoiceError
    );
    if (ok) invoicesApi.refetch();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Paiements"
        description="Suivez les factures du cabinet, envoyez-les, encaissez-les ou annulez-les. La création et la modification d’une facture restent réservées à l’avocat."
      />

      {feedback ? (
        <div className={`rounded-xl border p-3 text-sm ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {feedback.message}
        </div>
      ) : null}

      <AsyncState
        loading={invoicesApi.loading && !invoicesApi.data}
        error={invoicesApi.error}
        onRetry={invoicesApi.refetch}
        isEmpty={invoices.length === 0}
        emptyMessage="Aucune facture pour le moment."
        loadingMessage="Chargement des factures…"
      >
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="À encaisser" value={formatMoney(totals.toCollect.amount)} trend={`${totals.toCollect.count} facture(s)`} accent="blue" />
            <StatCard label="En retard" value={formatMoney(totals.late.amount)} trend={`${totals.late.count} facture(s)`} accent="rose" />
            <StatCard label="Encaissé" value={formatMoney(totals.collected.amount)} trend={`${totals.collected.count} facture(s)`} accent="emerald" />
          </div>

          <SectionCard title="Factures">
            <div className="mb-4 flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${activeTab === item.key ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}
                >
                  {item.label} ({groups[item.key].length})
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune facture dans cette catégorie.</p>
            ) : (
              <div className="space-y-3">
                {list.map((invoice) => {
                  const linked = caseById[invoice.caseId];
                  const clientName = clientNames[invoice.clientId] || clientNames[linked?.clientId] || 'Inconnu';
                  const delay = describeDelay(invoice, now);
                  const actions = invoiceActions(invoice, { isAdmin: false });
                  const busy = Boolean(busyKey);
                  return (
                    <div key={invoice.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-800">{invoice.invoiceNumber} · {formatMoney(invoice.amount)}</span>
                          <StatusBadge tone={tabInfo.tone}>{tabInfo.badge}</StatusBadge>
                        </div>
                        <div className="text-sm text-slate-500">
                          Client : {clientName}{linked ? ` · ${linked.reference} · ${linked.title}` : ''}
                        </div>
                        <div className="text-sm text-slate-500">Échéance : {formatDay(invoice.dueDate)}</div>
                        {delay ? <div className="text-sm font-medium text-slate-700">{delay}</div> : null}
                        {invoice.description ? <div className="mt-1 text-sm text-slate-600">{invoice.description}</div> : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {actions.canSend ? (
                          <button type="button" className={secondaryButton} disabled={busy} onClick={() => changeStatus(invoice, 'SENT', 'Facture envoyée.')}>
                            Envoyer
                          </button>
                        ) : null}
                        {actions.canPay ? (
                          <button
                            type="button"
                            className={secondaryButton}
                            disabled={busy}
                            onClick={() => changeStatus(invoice, 'PAID', 'Facture marquée comme payée.', `Marquer la facture ${invoice.invoiceNumber} comme payée ? Elle ne pourra plus être modifiée.`)}
                          >
                            Payée
                          </button>
                        ) : null}
                        {actions.canCancel ? (
                          <button
                            type="button"
                            className={dangerButton}
                            disabled={busy}
                            onClick={() => changeStatus(invoice, 'CANCELLED', 'Facture annulée.', `Annuler la facture ${invoice.invoiceNumber} ? Cette action est définitive.`)}
                          >
                            Annuler
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </AsyncState>
    </div>
  );
}
