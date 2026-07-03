import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api.js';
import { useAuth } from '@/hooks/useAuth.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

const extractedOutputRoute = (status) => {
  const map = {
    DRAFT: 'ingest',
    INGESTING: 'ingest',
    FILE_1_PROCESSING: 'file1',
    AWAITING_PLAN_CONFIRMATION: 'plan',
    FILE_2_PROCESSING: 'file2',
    EXTRACTED: 'file2',
    EXCEPTION_REVIEW: 'file2',
    READY_FOR_APPROVAL: 'file2',
    APPROVED: 'file2',
    REJECTED: 'file2',
  };
  return map[status] ?? 'file2';
};

export default function ContractListPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.roles?.some(r => (r.code || r) === 'ADMIN' || (r.code || r) === 'system_admin');

  const refresh = () => {
    apiFetch('/contracts')
      .then(data => setContracts(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Contracts</h1>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 size-4" /> New Contract
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface)] text-left text-[var(--color-text-secondary)]">
            <tr>
              <th className="w-8 px-2 py-3" />
              <th className="px-4 py-3 font-medium">Contract No</th>
              <th className="px-4 py-3 font-medium">Contract Name</th>
              <th className="px-4 py-3 font-medium">Contractor</th>
              <th className="px-4 py-3 font-medium text-right">Original Value</th>
              <th className="px-4 py-3 font-medium text-right">Packages</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contracts.map(c => (
              <ContractRow
                key={c.id}
                contract={c}
                expanded={!!expanded[c.id]}
                onToggle={() => toggleExpand(c.id)}
                navigate={navigate}
              />
            ))}
            {contracts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-[var(--color-text-secondary)]">No contracts found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Contract Dialog */}
      {showCreate && <NewContractDialog onClose={() => setShowCreate(false)} onCreated={refresh} />}
    </div>
  );
}

function ContractRow({ contract: c, expanded, onToggle, navigate }) {
  const [recentPkgs, setRecentPkgs] = useState(null);

  useEffect(() => {
    if (expanded && !recentPkgs) {
      apiFetch(`/contracts/${c.id}/packages?limit=3`)
        .then(setRecentPkgs)
        .catch(() => setRecentPkgs([]));
    }
  }, [expanded, c.id, recentPkgs]);

  return (
    <>
      <tr className="hover:bg-[var(--color-surface)] cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-3">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </td>
        <td className="px-4 py-3 font-mono text-xs">{c.contractNo || '—'}</td>
        <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">{c.contractName}</td>
        <td className="px-4 py-3">{c.contractorName || '—'}</td>
        <td className="px-4 py-3 text-right font-mono">{c.originalValue != null ? fmtMoney(c.originalValue) : '—'}</td>
        <td className="px-4 py-3 text-right">{c._count?.packages || c.packageCount || 0}</td>
        <td className="px-4 py-3">
          <span className={`text-xs font-medium ${c.isActive !== false ? 'text-[var(--color-valid)]' : 'text-[var(--color-text-secondary)]'}`}>
            {c.isActive !== false ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-[var(--color-surface)] px-8 py-3">
            {!recentPkgs ? (
              <Skeleton className="h-8 w-full" />
            ) : recentPkgs.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">No packages yet</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">Recent Packages:</p>
                {recentPkgs.map(p => (
                  <div key={p.id} className="flex items-center gap-3 text-xs">
                    <span className="text-[var(--color-text-primary)]">{p.billingPeriodLabel}</span>
                    <span className={`font-medium ${p.packageStatus === 'APPROVED' ? 'text-[var(--color-valid)]' : 'text-[var(--color-text-secondary)]'}`}>{p.packageStatus}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-5 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/packages/${p.id}/${extractedOutputRoute(p.packageStatus)}`);
                      }}
                    >
                      See Extracted Output
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function NewContractDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ contractNo: '', contractName: '', contractorName: '', originalValue: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.contractName.trim()) { setError('Contract name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await apiFetch('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          originalValue: form.originalValue ? parseFloat(form.originalValue) : null,
        }),
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Contract No</label>
            <Input value={form.contractNo} onChange={(e) => setForm(f => ({ ...f, contractNo: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Contract Name *</label>
            <Input value={form.contractName} onChange={(e) => setForm(f => ({ ...f, contractName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Contractor Name</label>
            <Input value={form.contractorName} onChange={(e) => setForm(f => ({ ...f, contractorName: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Original Value</label>
            <Input type="number" value={form.originalValue} onChange={(e) => setForm(f => ({ ...f, originalValue: e.target.value }))} />
          </div>
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-3 animate-spin" />}
              Create Contract
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fmtMoney(v) {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
