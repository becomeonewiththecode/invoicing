import type { InvoiceStatus } from '../../types';

const statusStyles: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
