import { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { useShell } from '@/contexts/ShellContext.jsx';
import { Loader2, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function deriveCode(name) {
  if (!name) return '—';
  // Take first 3 uppercase letters from words
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase().slice(0, 3);
}

export default function PlanPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { steps } = useOutletContext();
  const { setShellData } = useShell();
  const [plan, setPlan] = useState(null);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    setShellData({ statusLabel: 'Plan Review · Awaiting confirmation', statusTone: 'warn' });
  }, [setShellData]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch(`/packages/${packageId}/agent-plan`);
        setPlan(data);
        // Default: select ALL items (send all in confirm payload per spec)
        const defaults = {};
        (data.items || []).forEach(item => { defaults[item.id] = true; });
        setSelected(defaults);
        if (data.status === 'confirmed') setConfirmed(true);
      } catch (e) {
        console.error('PlanPage load error:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [packageId]);

  const items = plan?.items || [];
  // All selected by default; confirm payload sends all
  const selectedItems = items; // always all

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await apiFetch(`/pipeline/${packageId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          stepName: 'AGENT_PLAN',
          confirmedItems: selectedItems.map(i => i.subcontractorName),
        }),
      });
      setConfirmed(true);
      setTimeout(() => navigate(`/packages/${packageId}/file2`), 800);
    } catch (e) {
      console.error('Confirm error:', e.message);
    } finally {
      setConfirming(false);
    }
  };

  const agentPlanStep = steps?.find(s => s.stepName === 'AGENT_PLAN');
  const isAlreadyConfirmed = confirmed || agentPlanStep?.status === 'confirmed' || agentPlanStep?.status === 'complete';

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-8">
      {/* Page header */}
      <h1 className="text-2xl font-semibold text-gray-900">Agent Plan — Sub-Contractors</h1>
      <p className="mt-1.5 text-sm text-gray-500 mb-6">
        The agent identified <strong>{items.length} sub-contractor{items.length !== 1 ? 's' : ''}</strong> in File 1. Confirm the list or edit before extraction begins on File 2.
      </p>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200">
            <tr className="text-left">
              <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium w-20">Code</th>
              <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium">Name</th>
              <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium w-36">Trade</th>
              <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-gray-400 font-medium text-right w-36">File 1 Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map(item => {
              const name = item.subcontractorName || item.subContractorName || item.description || '';
              const code = deriveCode(name);
              const trade = item.trade || item.tradeCategory || '—';
              const amount = parseFloat(item.billedAmountFile1 || item.billedAmount || 0);
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{code}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{name}</td>
                  <td className="px-4 py-3 text-gray-500">{trade}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">{fmtMoney(amount)}</td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400">No sub-contractors identified yet</td>
              </tr>
            )}
            {/* + Add sub-contractor row */}
            <tr>
              <td colSpan={4} className="px-4 py-3">
                <button className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add sub-contractor
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => navigate(`/packages/${packageId}/ingest`)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Go back
        </button>
        {isAlreadyConfirmed ? (
          <button
            onClick={() => navigate(`/packages/${packageId}/file2`)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue to File 2 →
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={confirming || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm & Begin File 2 Extraction →
          </button>
        )}
      </div>
    </div>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  if (n === 0) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
