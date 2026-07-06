import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassificationResult {
  doc_index: number;
  filename: string;
  file_type: string;
  confidence: number;
  method: string;
  reasoning: string;
}

interface Props {
  packageId: string;
  classifications: ClassificationResult[];
  onConfirmed: () => void;
}

// ─── File type options ────────────────────────────────────────────────────────

const FILE_TYPE_OPTIONS = [
  { value: 'GC_G702', label: 'GC Application for Payment (G702)' },
  { value: 'GC_G703', label: 'GC Continuation Sheet (G703)' },
  { value: 'SUB_G702', label: 'Sub Application for Payment (G702)' },
  { value: 'SUB_G703', label: 'Sub Continuation Sheet (G703)' },
  { value: 'OTHER',   label: 'Other / Supporting Document' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceColor(c: number) {
  if (c >= 0.85) return 'text-[var(--color-valid)]';
  if (c >= 0.65) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-error)]';
}

function methodLabel(m: string) {
  if (m === 'heuristic') return 'Keyword match';
  if (m === 'llm') return 'LLM (text)';
  if (m === 'vision') return 'LLM (vision)';
  if (m === 'human') return 'Human override';
  return m;
}

// ─── ClassificationModal ──────────────────────────────────────────────────────

export default function ClassificationModal({ packageId, classifications, onConfirmed }: Props) {
  const [overrides, setOverrides] = useState<Record<number, string>>(
    Object.fromEntries(classifications.map((c) => [c.doc_index, c.file_type])),
  );

  const { mutate: confirm, isPending, error } = useMutation({
    mutationFn: () => {
      const confirmed = classifications.map((c) => {
        const chosenType = overrides[c.doc_index] ?? c.file_type;
        const wasOverridden = chosenType !== c.file_type;
        return {
          ...c,
          file_type: chosenType,
          confidence: wasOverridden ? 1.0 : c.confidence,
          method: wasOverridden ? 'human' : c.method,
          reasoning: wasOverridden
            ? `User overrode AI classification from ${c.file_type} to ${chosenType}`
            : c.reasoning,
        };
      });
      return apiFetch(`/packages/${packageId}/resume`, {
        method: 'POST',
        body: JSON.stringify({ classifications: confirmed }),
      }) as Promise<unknown>;
    },
    onSuccess: () => onConfirmed(),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classify-modal-title"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-[var(--color-border)] p-6 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50">
            <AlertTriangle className="h-5 w-5 text-[var(--color-warning)]" />
          </div>
          <div>
            <h2 id="classify-modal-title" className="text-base font-semibold">
              Confirm Document Classifications
            </h2>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Review AI classifications and correct any errors before the pipeline continues.
            </p>
          </div>
        </div>

        {/* Classification list */}
        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-3">
          {classifications.map((c) => (
            <div
              key={c.doc_index}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium" title={c.filename}>
                    {c.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span>
                      Method:{' '}
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {methodLabel(c.method)}
                      </span>
                    </span>
                    <span>·</span>
                    <span>
                      Confidence:{' '}
                      <span className={`font-semibold ${confidenceColor(c.confidence)}`}>
                        {(c.confidence * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  {c.reasoning && (
                    <p className="mt-1.5 text-xs italic text-[var(--color-text-secondary)]">
                      {c.reasoning}
                    </p>
                  )}
                </div>

                {/* Override dropdown */}
                <div className="shrink-0">
                  <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                    Type
                  </label>
                  <select
                    value={overrides[c.doc_index] ?? c.file_type}
                    onChange={(e) =>
                      setOverrides((prev) => ({ ...prev, [c.doc_index]: e.target.value }))
                    }
                    className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
                  >
                    {FILE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Show override indicator */}
              {overrides[c.doc_index] && overrides[c.doc_index] !== c.file_type && (
                <p className="mt-2 text-xs text-[var(--color-warning)]">
                  ⚠ Overriding AI suggestion ({c.file_type}) → {overrides[c.doc_index]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-border)] p-6 pt-4">
          {error && (
            <p className="text-xs text-[var(--color-error)]">
              {error instanceof Error ? error.message : 'Failed to confirm. Please try again.'}
            </p>
          )}
          <div className="ml-auto">
            <button
              onClick={() => void confirm()}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isPending ? 'Confirming…' : 'Confirm & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
