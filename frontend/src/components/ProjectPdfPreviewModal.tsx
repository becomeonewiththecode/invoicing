import { useEffect, useState } from 'react';
import { HiOutlineX } from 'react-icons/hi';
import type { Project } from '../api/projects';
import { buildProjectPdfBlob, downloadProjectPdf } from '../utils/projectPdf';

type Props = {
  open: boolean;
  onClose: () => void;
  project: Project | null;
  clientLabel?: string;
};

export function ProjectPdfPreviewModal({ open, onClose, project, clientLabel }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !project) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
      return;
    }

    setError(null);
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    let cancelled = false;

    /** Defer past Strict Mode’s synchronous effect cleanup so we don’t attach a revoked blob URL to the iframe. */
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const blob = buildProjectPdfBlob(project, clientLabel);
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Could not generate preview.');
      }
    });

    return () => {
      cancelled = true;
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open, project, clientLabel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleDownload = () => {
    if (!project) return;
    try {
      downloadProjectPdf(project, clientLabel);
    } catch {
      setError('Could not download PDF.');
    }
  };

  if (!open) return null;

  if (!project) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
        <div className="bg-white rounded-xl shadow-xl px-8 py-6 flex items-center gap-4">
          <span className="text-gray-600">Loading…</span>
          <button type="button" onClick={onClose} className="text-sm text-blue-600 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const title = project.name || 'Project';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-pdf-preview-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 id="project-pdf-preview-title" className="text-lg font-semibold text-gray-900 truncate pr-2">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
            aria-label="Close"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>
        <p className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100 bg-gray-50">
          Preview the PDF below. Download a copy or close to return.
        </p>
        <div className="flex-1 min-h-[320px] bg-gray-100 relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-600 px-4 text-center">{error}</div>
          )}
          {pdfUrl && !error && (
            <iframe
              key={pdfUrl}
              title="Project PDF preview"
              src={pdfUrl}
              className="w-full h-full min-h-[min(70vh,720px)] border-0 rounded-b-lg"
            />
          )}
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!pdfUrl || !!error}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}
