import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import AsyncState from '../../components/common/AsyncState';
import useApi from '../../hooks/useApi';
import { getInvoiceStatusDisplay } from '../../constants/invoiceStatus';
import { formatAmount } from '../../constants/currency';
import { formatDate } from '../../constants/caseStatus';

const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);

export default function ClientPaymentsPage() {
  const { data, loading, error, refetch } = useApi('/api/invoices');
  const invoices = useMemo(
    () => [...(Array.isArray(data) ? data : [])].filter((item) => item.status !== 'DRAFT').sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate))),
    [data]
  );
  const due = invoices.filter((item) => item.status === 'SENT' || item.status === 'OVERDUE');
  const late = invoices.filter((item) => item.status === 'OVERDUE');
  const paid = invoices.filter((item) => item.status === 'PAID');
  const value = (amount) => (loading || error ? '—' : formatAmount(amount));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mes paiements" title="Factures et règlements" description="Consultez vos factures. Le règlement s’effectue auprès du cabinet." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon="receipt" accent="blue" label="Reste à payer" value={value(sum(due))} trend={`${due.length} facture(s)`} />
        <StatCard icon="clock" accent="rose" label="En retard" value={value(sum(late))} trend={`${late.length} facture(s)`} />
        <StatCard icon="check" accent="emerald" label="Déjà réglé" value={value(sum(paid))} trend={`${paid.length} facture(s)`} />
      </div>
      <SectionCard title="Mes factures">
        <AsyncState loading={loading} error={error} onRetry={refetch} isEmpty={invoices.length === 0} emptyMessage="Aucune facture pour le moment.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 text-start font-medium">N°</th>
                  <th className="py-2 text-start font-medium">Description</th>
                  <th className="py-2 text-start font-medium">Échéance</th>
                  <th className="py-2 text-end font-medium">Montant</th>
                  <th className="py-2 text-end font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => {
                  const status = getInvoiceStatusDisplay(invoice.status);
                  return (
                    <tr key={invoice.id}>
                      <td className="py-3 font-medium text-slate-800">{invoice.invoiceNumber}</td>
                      <td className="py-3 text-slate-600">{invoice.description}</td>
                      <td className="py-3 text-slate-600">{formatDate(invoice.dueDate)}</td>
                      <td className="py-3 text-end font-semibold text-slate-900">{formatAmount(invoice.amount)}</td>
                      <td className="py-3 text-end"><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AsyncState>
      </SectionCard>
    </div>
  );
}
