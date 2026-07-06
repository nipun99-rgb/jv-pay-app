import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Send, Bot, User, Loader2, Play } from 'lucide-react';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  intent?: string;
  ts: Date;
  action?: { label: string; onClick: () => void };
}

// Simple inline markdown renderer (bold, italic)
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-primary)] opacity-60"
          style={{ animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite` }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
        isUser ? 'bg-[var(--color-brand-primary)] text-white' : 'bg-gray-200 text-gray-600'
      }`}>
        {isUser ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
        <div className={`rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
          isUser
            ? 'rounded-tr-sm bg-[var(--color-brand-primary)] text-white'
            : 'rounded-tl-sm bg-gray-100 text-[var(--color-foreground)]'
        }`}>
          {isUser ? msg.content : renderMarkdown(msg.content)}
          <div className={`mt-0.5 text-[9px] ${isUser ? 'text-white/60 text-right' : 'text-gray-400'}`}>
            {msg.ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {msg.action && (
          <button
            onClick={msg.action.onClick}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-brand-primary)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-brand-primary)] hover:bg-blue-50 transition-colors"
          >
            <Play className="h-3 w-3" />
            {msg.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Sub-agent registry ───────────────────────────────────────────────────────
const AGENTS: Record<string, { name: string; color: string; bg: string; icon: string }> = {
  ingest:              { name: 'File Manager',          color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    icon: '📁' },
  classify:            { name: 'Doc Classifier',        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: '🔍' },
  human_classify_gate: { name: 'Classification Gate',   color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: '⏸️' },
  extract_gc_header:   { name: 'GC Cover Extractor',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  icon: '📋' },
  extract_gc_sov:      { name: 'G703 Parser',           color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: '📊' },
  generate_plan:       { name: 'Sub Planner',           color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',    icon: '🗂️' },
  human_plan_gate:     { name: 'Plan Gate',             color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',    icon: '⏸️' },
  extract_subs:        { name: 'Sub Extractor',         color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: '👷' },
  verify:              { name: 'Data Verifier',         color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200',      icon: '✔️' },
  reconcile:           { name: 'Reconciliation Engine', color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      icon: '⚖️' },
  human_review_gate:   { name: 'Review Gate',           color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',    icon: '👁️' },
};

interface SubAgentMessage {
  node: string;
  message: string;
  eventType: string;
  ts: string;
}

// ─── Sub-agent bubble ─────────────────────────────────────────────────────────
function SubAgentBubble({ msg }: { msg: SubAgentMessage }) {
  const agent = AGENTS[msg.node] ?? { name: msg.node, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: '🤖' };
  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] leading-relaxed ${agent.bg}`}>
      <div className={`flex items-center gap-1.5 font-semibold mb-1 ${agent.color}`}>
        <span>{agent.icon}</span>
        <span>{agent.name}</span>
        <span className="ml-auto font-normal text-[9px] text-gray-400 tabular-nums">
          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
      <p className="text-gray-700">{msg.message}</p>
    </div>
  );
}

export function AgentPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subMsgs, setSubMsgs] = useState<SubAgentMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'pipeline'>('chat');
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const subBottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNodeRef = useRef<string | null>(null);
  const location = useLocation();

  // Monitor pipeline and inject agent messages at key milestones
  const startMonitoring = useCallback((pkgId: string) => {
    if (monitorRef.current) clearInterval(monitorRef.current);
    lastNodeRef.current = null;
    monitorRef.current = setInterval(async () => {
      try {
        const ai = await apiFetch(`/packages/${pkgId}/ai-status`) as {
          status: string; current_node: string | null;
        };
        const node = ai.current_node;
        if (!node || node === lastNodeRef.current) return;
        lastNodeRef.current = node;

        const milestones: Record<string, string> = {
          human_classify_gate:
            '🔍 Documents have been classified! Please review and confirm the AI classification above before we proceed to extraction.',
          extract_gc_header:
            '📋 GC Header extraction in progress…',
          extract_gc_sov:
            '📊 Extracting GC Schedule of Values (G703)…',
          human_plan_gate:
            '📝 Sub-contractor plan is ready. Please review the list above and confirm which subs to extract.',
          extract_subs:
            '👷 Extracting sub-contractor pay applications…',
          reconcile:
            '⚖️ Running cross-file reconciliation checks…',
          human_review_gate:
            '✅ All done! The package is ready for your final review and approval.',
        };

        if (milestones[node]) {
          setMessages((prev) => [...prev, { role: 'agent', content: milestones[node], ts: new Date() }]);
        }

        // Stop monitoring when complete or failed
        if (ai.status === 'APPROVED' || ai.status === 'FAILED' || node === 'complete') {
          clearInterval(monitorRef.current!);
          monitorRef.current = null;
        }
      } catch { /* ignore */ }
    }, 4000);
  }, []);

  // Extract packageId from current URL path
  const packageIdMatch = location.pathname.match(/\/packages\/([^/]+)/);
  const packageId = packageIdMatch ? packageIdMatch[1] : null;

  // Reset messages and connect socket when packageId changes
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setTotalCost(0);
    setSubMsgs([]);
    setActiveTab('chat');

    if (!packageId) {
      setMessages([{ role: 'agent', content: "Open a package to start chatting.", ts: new Date() }]);
      return;
    }

    // Generic greeting first
    setMessages([{ role: 'agent', content: "Hello! I'm your AI review agent. One moment while I check your package…", ts: new Date() }]);

    // Fetch package status to give a contextual proactive greeting
    apiFetch(`/packages/${packageId}`).then((pkg: unknown) => {
      const p = pkg as { status: string; projectName: string; documents?: { filename: string }[] };
      const filename = p.documents?.[0]?.filename ?? 'your document';

      let greeting: string;
      let action: ChatMessage['action'] | undefined;

      if (p.status === 'PENDING') {
        greeting = `I can see you've uploaded **${filename}** for **${p.projectName}**. Ready to begin AI processing? I can start the pipeline for you, or you can press "Start Processing" above.`;
        action = {
          label: 'Start pipeline now',
          onClick: () => {
            // Remove button immediately on click
            setMessages((prev) => prev.map((m) =>
              m.action?.label === 'Start pipeline now' ? { ...m, action: undefined } : m
            ));
            apiFetch(`/packages/${packageId}/run`, { method: 'POST' }).then(() => {
              setMessages((prev) => [
                ...prev,
                { role: 'agent', content: '✅ Pipeline started! It will run through ingestion and classification, then pause for your review at the **Preliminary Classification** step.', ts: new Date() },
              ]);
              startMonitoring(packageId);
            }).catch(() => {
              setMessages((prev) => [
                ...prev,
                { role: 'agent', content: '⚠️ Could not start the pipeline. Please try the "Start Processing" button above.', ts: new Date() },
              ]);
            });
          },
        };
      } else if (p.status === 'APPROVED') {
        greeting = `This package has been **approved**. Payment due has been certified. You can view the exception log or return to the dashboard.`;
      } else if (p.status === 'FAILED') {
        greeting = `It looks like the pipeline encountered an error. Ask me what went wrong or try re-running it.`;
      } else {
        greeting = `I'm monitoring the pipeline for **${p.projectName}**. Ask me about extracted values, exceptions, or pipeline status.`;
        // Already running — start monitoring immediately
        startMonitoring(packageId);
      }

      setMessages([{ role: 'agent', content: greeting, ts: new Date(), action }]);
    }).catch(() => {
      setMessages([{ role: 'agent', content: "Hello! I'm your AI review agent. Ask me about field values, exceptions, or pipeline status.", ts: new Date() }]);
    });

    // Connect socket for live chat
    const socket = io('http://localhost:3001', { withCredentials: true });
    socketRef.current = socket;
    socket.emit('join', `package:${packageId}`);

    socket.on('chat_reply', (data: { reply: string; intent?: string; cost_usd?: number }) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'agent', content: data.reply, intent: data.intent, ts: new Date() }]);
      if (data.cost_usd) setTotalCost((prev) => prev + data.cost_usd!);
    });

    socket.on('agent_message', (data: SubAgentMessage) => {
      setSubMsgs((prev) => [...prev, data]);
      // Auto-switch to pipeline tab when agents are active
      setActiveTab('pipeline');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null; }
    };
  }, [packageId]);

  // Auto-scroll to bottom
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => { subBottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [subMsgs]);

  const sendMessage = useCallback(() => {
    const msg = draft.trim();
    if (!msg || !packageId || isTyping || !socketRef.current) return;

    setDraft('');
    setMessages((prev) => [...prev, { role: 'user', content: msg, ts: new Date() }]);

    // Intercept "start" intent — trigger pipeline directly
    const isStartCmd = /\b(start|begin|kick off|run|go|yes|do it|process)\b/i.test(msg);
    if (isStartCmd) {
      setIsTyping(true);
      apiFetch(`/packages/${packageId}/run`, { method: 'POST' })
        .then(() => {
          setIsTyping(false);
          setMessages((prev) => [...prev, {
            role: 'agent',
            content: '✅ Pipeline started! It will run through ingestion and classification, then pause at **Preliminary Classification** for your review.',
            ts: new Date(),
          }]);
          startMonitoring(packageId);
        })
        .catch(() => {
          setIsTyping(false);
          // Fall back to normal chat if run fails (pipeline may already be running)
          socketRef.current?.emit('chat', { packageId, message: msg });
          setIsTyping(true);
        });
      return;
    }

    setIsTyping(true);
    socketRef.current.emit('chat', { packageId, message: msg });
  }, [draft, packageId, isTyping]);

  return (
    <aside className={`
      border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col shrink-0
      transition-all duration-200 ${collapsed ? 'w-10' : 'w-80'}
    `}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 border-b border-[var(--color-border)] h-12 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-[var(--color-brand-primary)]" />
            <span className="text-xs font-semibold">AI Agent</span>
            {packageId && <span className="h-1.5 w-1.5 rounded-full bg-green-400" title="Connected" />}
          </div>
        )}
        <button onClick={() => setCollapsed((c) => !c)}
          className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
          aria-label={collapsed ? 'Expand agent panel' : 'Collapse agent panel'}>
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="flex border-b border-[var(--color-border)] shrink-0">
          {(['chat', 'pipeline'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-[var(--color-brand-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}>
              {tab === 'chat' ? '💬 Chat' : '🤖 Pipeline Agents'}
              {tab === 'pipeline' && subMsgs.length > 0 && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-[9px] text-white font-bold">
                  {subMsgs.length > 9 ? '9+' : subMsgs.length}
                </span>
              )}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-brand-primary)]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Chat tab ──────────────────────────────────────────────────────── */}
      {!collapsed && activeTab === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {isTyping && (
              <div className="flex gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100"><TypingDots /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && packageId && (
            <div className="px-3 pb-2 space-y-1 shrink-0">
              {['Start the pipeline for me', 'What is the current payment due?', 'Are there any open exceptions?', 'What is the pipeline status?'].map((prompt) => (
                <button key={prompt} onClick={() => { setDraft(prompt); inputRef.current?.focus(); }}
                  className="w-full rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-left text-[10px] text-[var(--color-muted-foreground)] hover:bg-gray-50 hover:text-[var(--color-foreground)] transition-colors">
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Pipeline Agents tab ───────────────────────────────────────────── */}
      {!collapsed && activeTab === 'pipeline' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {subMsgs.length === 0 ? (
            <p className="text-center text-[11px] text-[var(--color-text-secondary)] pt-8">
              Agent activity will appear here once the pipeline starts.
            </p>
          ) : (
            subMsgs.map((m, i) => <SubAgentBubble key={i} msg={m} />)
          )}
          <div ref={subBottomRef} />
        </div>
      )}

      {/* ── Cost footer ───────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="border-t border-[var(--color-border)] px-3 py-1.5 text-[10px] text-[var(--color-muted-foreground)] flex justify-between items-center shrink-0">
          <span>Session cost</span>
          <span className="font-mono">${totalCost.toFixed(4)}</span>
        </div>
      )}

      {/* ── Chat input (only on chat tab) ─────────────────────────────────── */}
      {!collapsed && (
        <div className="border-t border-[var(--color-border)] p-2 shrink-0">
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-brand-primary)] focus-within:border-[var(--color-brand-primary)]">
            <input ref={inputRef} type="text" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={packageId ? 'Ask the agent…' : 'Open a package first'}
              disabled={!packageId || isTyping}
              className="flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed"
            />
            <button onClick={sendMessage} disabled={!draft.trim() || !packageId || isTyping}
              className="shrink-0 rounded p-0.5 text-[var(--color-brand-primary)] hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity" aria-label="Send">
              {isTyping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

