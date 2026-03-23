import type { InvoiceStatus } from '../../types';

const statusStyles: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  late: 'bg-red-100 text-red-700',
  cancelled: 'bg-orange-100 text-orange-700',
};

const statusLabel: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  late: 'Late',
  cancelled: 'Cancelled',
};

function normalizeStatus(s: string): InvoiceStatus {
  if (s === 'overdue') return 'late';
  return s as InvoiceStatus;
}

export function StatusBadge({ status }: { status: InvoiceStatus | 'overdue' }) {
  const key = normalizeStatus(status);
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${statusStyles[key]}`}>
      {statusLabel[key]}
    </span>
  );
}
