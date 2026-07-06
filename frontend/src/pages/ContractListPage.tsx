/**
 * ContractListPage — Sprint 10.
 * Clients list with their contracts. Create client + contract modals.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Building2, FileStack, ChevronDown, ChevronRight,
  Loader2, X, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  name: string;
  projectAddress: string | null;
  contractValue: string | null;
  startDate: string | null;
  endDate: string | null;
  _count?: { packages: number };
  packages?: Array<{ id: string; projectName: string; status: string }>;
}

interface Client {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contracts: Contract[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v: string | null): string {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtDate(v: string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ─── New Client Modal ─────────────────────────────────────────────────────────

function NewClientModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      apiFetch('/clients', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), contactName: contactName.trim() || undefined, contactEmail: contactEmail.trim() || undefined }),
      }) as Promise<Client>,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-base font-semibold">New Client</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium mb-1">Client Name <span className="text-red-500">*</span></label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Boeing Co."
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contact Name</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
              placeholder="e.g. jane@boeing.com"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
          </div>
          {error && <p className="text-xs text-[var(--color-error)]">{error instanceof Error ? error.message : 'Failed'}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={() => void mutate()} disabled={!name.trim() || isPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Create Client
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Contract Modal ───────────────────────────────────────────────────────

function NewContractModal({ clients, onClose }: { clients: Client[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      apiFetch('/contracts', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          name: name.trim(),
          projectAddress: address.trim() || undefined,
          contractValue: value ? parseFloat(value) : undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate:   endDate   ? new Date(endDate).toISOString()   : undefined,
        }),
      }) as Promise<Contract>,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-base font-semibold">New Contract</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="block text-xs font-medium mb-1">Client <span className="text-red-500">*</span></label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]">
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Contract Name <span className="text-red-500">*</span></label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BSC Site Expansion — Phase 1"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Project Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 100 N Riverside Plaza, Chicago IL"
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Contract Value ($)</label>
              <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]" />
            </div>
          </div>
          {error && <p className="text-xs text-[var(--color-error)]">{error instanceof Error ? error.message : 'Failed'}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={() => void mutate()} disabled={!name.trim() || !clientId || isPending}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Create Contract
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contract Row ─────────────────────────────────────────────────────────────

function ContractRow({ contract }: { contract: Contract }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={() => navigate(`/packages/new?contractId=${contract.id}`)}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{contract.name}</p>
        {contract.projectAddress && (
          <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">{contract.projectAddress}</p>
        )}
      </div>
      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)]">Value</p>
          <p className="text-sm font-medium">{fmtCurrency(contract.contractValue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)]">Duration</p>
          <p className="text-sm">{fmtDate(contract.startDate)} – {fmtDate(contract.endDate)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--color-text-secondary)]">Packages</p>
          <p className="text-sm font-semibold">{contract._count?.packages ?? 0}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({ client }: { client: Client }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">{client.name}</p>
            {client.contactName && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                {client.contactName}{client.contactEmail ? ` · ${client.contactEmail}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
            {client.contracts.length} contract{client.contracts.length !== 1 ? 's' : ''}
          </span>
          {expanded ? <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--color-text-secondary)]" />}
        </div>
      </button>

      {/* Contracts */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] px-5 py-4 space-y-2">
          {client.contracts.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">
              No contracts yet.
            </p>
          ) : (
            client.contracts.map((c) => <ContractRow key={c.id} contract={c} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── ContractListPage ─────────────────────────────────────────────────────────

export default function ContractListPage() {
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewContract, setShowNewContract] = useState(false);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => apiFetch('/clients') as Promise<Client[]>,
    staleTime: 30_000,
  });

  const totalContracts = clients.reduce((sum, c) => sum + c.contracts.length, 0);
  const totalPackages = clients.reduce((sum, c) =>
    sum + c.contracts.reduce((s2, ct) => s2 + (ct._count?.packages ?? 0), 0), 0);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contracts</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {totalContracts} contract{totalContracts !== 1 ? 's' : ''} · {totalPackages} package{totalPackages !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewContract(true)} disabled={clients.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Plus className="h-4 w-4" /> New Contract
          </button>
          <button onClick={() => setShowNewClient(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> New Client
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--color-border)] bg-white p-16 text-center">
          <Building2 className="h-10 w-10 opacity-20 text-[var(--color-text-secondary)]" />
          <div>
            <p className="text-sm font-medium">No clients yet</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Create a client to start organising packages by contract.</p>
          </div>
          <button onClick={() => setShowNewClient(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Create First Client
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => <ClientCard key={client.id} client={client} />)}
        </div>
      )}

      {showNewClient && <NewClientModal onClose={() => setShowNewClient(false)} />}
      {showNewContract && clients.length > 0 && (
        <NewContractModal clients={clients} onClose={() => setShowNewContract(false)} />
      )}
    </div>
  );
}

