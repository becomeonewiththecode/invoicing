import { useEffect, useState } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import type { Invoice, UserSettings } from '../types';
import { generateInvoicePdf } from '../utils/pdf';
import { ExternalLinksList } from './ExternalLinksList';
import { externalLinksFromInvoicePayload } from '../utils/externalLinksDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  company: UserSettings | null;
  title?: string;
  /** draft = unsaved form preview; saved = persisted invoice */
  variant?: 'draft' | 'saved';
};

export function InvoicePreviewModal({
  open,
  onClose,
  invoice,
  company,
  title = 'Invoice preview',
  variant = 'saved',
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const externalLinks = externalLinksFromInvoicePayload(invoice?.project_external_links);

  useEffect(() => {
    if (!open || !invoice) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    (async () => {
      try {
        const doc = await generateInvoicePdf(invoice, company);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        if (!cancelled) {
          setPdfUrl(url);
          setLoading(false);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setError('Could not generate preview.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, invoice, company]);

  useEffect(() => {
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const handleDownload = async () => {
    if (!invoice) return;
    try {
      const doc = await generateInvoicePdf(invoice, company);
      doc.save(`${invoice.invoice_number}.pdf`);
    } catch {
      setError('Could not download PDF.');
    }
  };

  if (!open) return null;

  if (!invoice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
        <div className="bg-white rounded-xl shadow-xl px-8 py-6 flex items-center gap-4">
          <span className="text-gray-600">Loading invoice…</span>
          <button type="button" onClick={onClose} className="text-sm text-blue-600 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-title">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 id="invoice-preview-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
        <p className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100 bg-gray-50">
          {variant === 'draft'
            ? 'Review the PDF below. Use Save or Create on the form to store the invoice—nothing is saved until you submit.'
            : 'Review the PDF below. Download a copy or close to return.'}
        </p>
        {externalLinks.length > 0 && (
          <div className="px-4 py-2 text-sm border-b border-gray-100 bg-white">
            <p className="text-gray-700 font-medium">External links (open in new tab):</p>
            <ExternalLinksList links={externalLinks} className="mt-1 space-y-1 list-none pl-0" />
          </div>
        )}
        <div className="flex-1 min-h-[320px] bg-gray-100 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500">Generating preview…</div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-red-600 px-4 text-center">{error}</div>
          )}
          {pdfUrl && !loading && (
            <iframe title="Invoice PDF preview" src={pdfUrl} className="w-full h-full min-h-[min(70vh,720px)] border-0 rounded-b-lg" />
          )}
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!invoice || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
