import { useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { describeDelay, formatDay, formatMoney, groupInvoices, invoiceTotals } from '../../utils/invoices';

const TABS = [
  { key: 'late', label: 'En retard', tone: 'rose' },
  { key: 'open', label: 'À régler', tone: 'blue' },
  { key: 'paid', label: 'Payées', tone: 'emerald' },
  { key: 'cancelled', label: 'Annulées', tone: 'slate' }
];

export default function ClientPaymentsPage() {
  const invoicesState = useApi('/api/invoices');
  const casesState = useApi('/api/cases');
  const [tab, setTab] = useState(null);

  const now = useMemo(() => new Date(), []);
  // Le client ne voit jamais les brouillons : ils sont exclus ici (à filtrer aussi côté serveur).
  const invoices = useMemo(
    () => (Array.isArray(invoicesState.data) ? invoicesState.data.filter((item) => item.status !== 'DRAFT') : []),
    [invoicesState.data]
  );
  const groups = useMemo(() => groupInvoices(invoices, now), [invoices, now]);
  const totals = useMemo(() => invoiceTotals(invoices, now), [invoices, now]);
  const caseById = useMemo(
    () => Object.fromEntries((Array.isArray(casesState.data) ? casesState.data : []).map((item) => [item.id, item])),
    [casesState.data]
  );

  const activeTab = tab || (groups.late.length > 0 ? 'late' : 'open');
  const list = groups[activeTab] || [];
  const tone = TABS.find((item) => item.key === activeTab)?.tone || 'slate';
  const badgeLabel = { late: 'En retard', open: 'À régler', paid: 'Payée', cancelled: 'Annulée' }[activeTab];

  return (
    <div>
      <PageHeader eyebrow="Mes paiements" title="Vos factures" description="Suivez les sommes à régler, les retards et vos paiements déjà effectués." />
      <AsyncState loading={invoicesState.loading} error={invoicesState.error} onRetry={invoicesState.refetch} isEmpty={invoices.length === 0} emptyMessage="Aucune facture pour le moment." loadingMessage="Chargement de vos factures…">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="À payer" value={formatMoney(totals.toCollect.amount)} trend={`${totals.toCollect.count} facture(s)`} accent="blue" />
            <StatCard label="En retard" value={formatMoney(totals.late.amount)} trend={`${totals.late.count} facture(s)`} accent="rose" />
            <StatCard label="Déjà payé" value={formatMoney(totals.collected.amount)} trend={`${totals.collected.count} facture(s)`} accent="emerald" />
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
                  const delay = describeDelay(invoice, now);
                  return (
                    <div key={invoice.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800">{invoice.invoiceNumber} · {formatMoney(invoice.amount)}</div>
                        {linked && <div className="text-sm text-slate-500">{linked.reference} · {linked.title}</div>}
                        <div className="text-sm text-slate-500">Échéance : {formatDay(invoice.dueDate)}</div>
                        {delay && <div className="text-sm font-medium text-slate-700">{delay}</div>}
                        {invoice.description && <div className="mt-1 text-sm text-slate-600">{invoice.description}</div>}
                      </div>
                      <StatusBadge tone={tone}>{badgeLabel}</StatusBadge>
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
