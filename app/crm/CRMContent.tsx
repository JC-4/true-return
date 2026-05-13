'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientStatus = 'Active' | 'Paused' | 'Closed'
type Market = 'Off Plan' | 'Secondary'

type Client = {
  id: string
  name: string
  status: ClientStatus
  market?: Market[]
  propertyType?: string
  minBudgetAED?: number
  maxBudgetAED?: number
  mortgageStatus?: string
  lastContacted?: string
  nextFollowUp?: string
  followUpAction?: string
  notes?: string
  savedAt: string
  updatedAt: string
}

type IndexEntry = { id: string; name: string; status: string; savedAt: string; updatedAt?: string }

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }
type StoredMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }

// Marker written by the server to signal a system/record-update message
const SYS_MARKER = '\x00SYS:'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function fmtAED(n?: number) {
  if (!n) return null
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

function fmtDate(iso?: string) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function isOverdue(date?: string): boolean {
  if (!date) return false
  return date < today()
}

function isSoon(date?: string): boolean {
  if (!date) return false
  const d = date
  const t = today()
  if (d <= t) return false
  const diff = (new Date(d).getTime() - new Date(t).getTime()) / 86_400_000
  return diff <= 3
}

function sortByFollowUp(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => {
    if (!a.nextFollowUp && !b.nextFollowUp) return 0
    if (!a.nextFollowUp) return 1
    if (!b.nextFollowUp) return -1
    return a.nextFollowUp.localeCompare(b.nextFollowUp)
  })
}

// ─── Add Client Modal ─────────────────────────────────────────────────────────

function AddClientModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [status, setStatus] = useState<ClientStatus>('Active')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/user/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), status, market: [], savedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    })
    setSaving(false)
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border border-[#e4e4e7] shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[#18181b] mb-4">Add client</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#71717a] mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full px-3 py-2 rounded-lg border border-[#e4e4e7] text-sm text-[#18181b] bg-white focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#71717a] mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as ClientStatus)}
              className="w-full px-3 py-2 rounded-lg border border-[#e4e4e7] text-sm text-[#18181b] bg-white focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981]"
            >
              <option>Active</option>
              <option>Paused</option>
              <option>Closed</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-[#71717a] bg-[#f4f4f5] hover:bg-[#e4e4e7] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Client Detail ────────────────────────────────────────────────────────────

function ClientDetail({ client, onUpdated, onDeleted }: {
  client: Client
  onUpdated: () => void
  onDeleted: () => void
}) {
  const [collapsed, setCollapsed] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function startEdit() {
    setForm({ ...client })
    setEditing(true)
  }

  function cancelEdit() {
    setForm({})
    setEditing(false)
  }

  async function saveEdit() {
    setSaving(true)
    await fetch(`/api/user/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    onUpdated()
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${client.name}? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/user/clients/${client.id}`, { method: 'DELETE' })
    setDeleting(false)
    onDeleted()
  }

  function set<K extends keyof Client>(key: K, value: Client[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const statusDot = (s: string) => {
    if (s === 'Active') return 'bg-[#10b981]'
    if (s === 'Paused') return 'bg-amber-400'
    return 'bg-zinc-400'
  }

  const inputCls = 'w-full px-3 py-1.5 rounded-lg border border-[#e4e4e7] text-sm text-[#18181b] bg-white focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981]'
  const labelCls = 'block text-[10px] font-semibold uppercase tracking-wide text-[#71717a] mb-1'

  return (
    <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot(client.status)}`} />
          <h2 className="text-base font-semibold text-[#18181b] truncate">{client.name}</h2>
          <span className="text-xs text-[#71717a] flex-shrink-0">{client.status}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!collapsed && (
            editing ? (
              <>
                <button onClick={cancelEdit} className="px-3 py-1 text-xs font-medium rounded-lg bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7] transition-colors">
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#18181b] text-white hover:bg-[#27272a] disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} className="px-3 py-1 text-xs font-medium rounded-lg bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7] transition-colors">
                  Edit
                </button>
                <button onClick={handleDelete} disabled={deleting} className="px-3 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                  {deleting ? '…' : 'Delete'}
                </button>
              </>
            )
          )}
          <button
            onClick={() => { setCollapsed(v => !v); if (!collapsed) setEditing(false) }}
            className="p-1 rounded-lg text-[#71717a] hover:text-[#18181b] hover:bg-[#f4f4f5] transition-colors"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg
              className="w-4 h-4 transition-transform duration-200"
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Collapsible content — grid-template-rows trick for smooth height animation */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 0.2s ease',
        }}
      >
        <div className="overflow-hidden">
      {editing ? (
        <div className="grid grid-cols-2 gap-3 pt-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.name ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status ?? 'Active'} onChange={e => set('status', e.target.value as ClientStatus)}>
              <option>Active</option>
              <option>Paused</option>
              <option>Closed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Property Type</label>
            <input className={inputCls} value={form.propertyType ?? ''} onChange={e => set('propertyType', e.target.value)} placeholder="Apartment, Villa…" />
          </div>
          <div>
            <label className={labelCls}>Mortgage Status</label>
            <input className={inputCls} value={form.mortgageStatus ?? ''} onChange={e => set('mortgageStatus', e.target.value)} placeholder="Cash, Mortgage…" />
          </div>
          <div>
            <label className={labelCls}>Min Budget (AED)</label>
            <input className={inputCls} type="number" value={form.minBudgetAED ?? ''} onChange={e => set('minBudgetAED', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <label className={labelCls}>Max Budget (AED)</label>
            <input className={inputCls} type="number" value={form.maxBudgetAED ?? ''} onChange={e => set('maxBudgetAED', e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div>
            <label className={labelCls}>Last Contacted</label>
            <input className={inputCls} type="date" value={form.lastContacted ?? ''} onChange={e => set('lastContacted', e.target.value || undefined)} />
          </div>
          <div>
            <label className={labelCls}>Next Follow-Up</label>
            <input className={inputCls} type="date" value={form.nextFollowUp ?? ''} onChange={e => set('nextFollowUp', e.target.value || undefined)} />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Follow-Up Action</label>
            <input className={inputCls} value={form.followUpAction ?? ''} onChange={e => set('followUpAction', e.target.value)} placeholder="What to do…" />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Context, history, preferences…"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4">
          {(client.minBudgetAED || client.maxBudgetAED) && (
            <div>
              <p className={labelCls}>Budget</p>
              <p className="text-sm text-[#18181b] font-medium">
                {fmtAED(client.minBudgetAED)}
                {client.minBudgetAED && client.maxBudgetAED ? ' – ' : ''}
                {fmtAED(client.maxBudgetAED)}
              </p>
            </div>
          )}
          {client.propertyType && (
            <div>
              <p className={labelCls}>Property Type</p>
              <p className="text-sm text-[#18181b]">{client.propertyType}</p>
            </div>
          )}
          {client.market && client.market.length > 0 && (
            <div>
              <p className={labelCls}>Market</p>
              <p className="text-sm text-[#18181b]">{client.market.join(', ')}</p>
            </div>
          )}
          {client.mortgageStatus && (
            <div>
              <p className={labelCls}>Mortgage</p>
              <p className="text-sm text-[#18181b]">{client.mortgageStatus}</p>
            </div>
          )}
          {client.lastContacted && (
            <div>
              <p className={labelCls}>Last Contacted</p>
              <p className="text-sm text-[#18181b]">{fmtDate(client.lastContacted)}</p>
            </div>
          )}
          {client.nextFollowUp && (
            <div>
              <p className={labelCls}>Next Follow-Up</p>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${isOverdue(client.nextFollowUp) ? 'text-red-600' : isSoon(client.nextFollowUp) ? 'text-amber-600' : 'text-[#18181b]'}`}>
                  {fmtDate(client.nextFollowUp)}
                </p>
                {isOverdue(client.nextFollowUp) && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600">OVERDUE</span>
                )}
                {isSoon(client.nextFollowUp) && !isOverdue(client.nextFollowUp) && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">SOON</span>
                )}
              </div>
            </div>
          )}
          {client.followUpAction && (
            <div className="col-span-2">
              <p className={labelCls}>Follow-Up Action</p>
              <p className="text-sm text-[#18181b]">{client.followUpAction}</p>
            </div>
          )}
          {client.notes && (
            <div className="col-span-2">
              <p className={labelCls}>Notes</p>
              <p className="text-sm text-[#18181b] whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            </div>
          )}
          <div className="col-span-2 pt-1 border-t border-[#f4f4f5]">
            <p className="text-[10px] text-[#a1a1aa]">
              Added {fmtDate(client.savedAt)}
              {client.updatedAt && client.updatedAt !== client.savedAt ? ` · Updated ${fmtDate(client.updatedAt)}` : ''}
            </p>
          </div>
        </div>
      )}
        </div>{/* overflow-hidden inner */}
      </div>{/* grid collapsible wrapper */}
    </div>
  )
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({ chatId, client, onClientsMaybeChanged }: {
  chatId: string            // 'general' or a client ID — component remounts on change via key=
  client: Client | null     // null in general mode
  onClientsMaybeChanged: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load persisted history on mount (component remounts when chatId changes via key=)
  useEffect(() => {
    fetch(`/api/user/chat/${chatId}`)
      .then(r => r.json())
      .then((history: StoredMessage[]) => {
        setMessages(history.map(m => ({ role: m.role, content: m.content })))
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true))
  }, []) // [] intentional: key={chatId} guarantees a fresh mount per chatId

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const globalChips = ["Today's focus", "Who's overdue?", "Full summary"]

  const clientChips = client ? [
    `What should I do next with ${client.name}?`,
    `Draft a WhatsApp to ${client.name}`,
    `What properties suit ${client.name}?`,
  ] : []

  const clearChat = useCallback(async () => {
    if (clearing || streaming) return
    setClearing(true)
    try {
      const res = await fetch(`/api/user/chat/${chatId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ today: today() }),
      })
      const data = await res.json() as { ok: boolean; updatesApplied: number; warning?: string }
      setMessages([{
        role: 'system',
        content: data.warning
          ? 'Chat cleared. Note: updates could not be saved automatically — check client notes manually.'
          : 'Chat cleared. Any important updates have been saved to client notes.',
      }])
      onClientsMaybeChanged()
    } catch {
      setMessages([{
        role: 'system',
        content: 'Chat cleared. Note: updates could not be saved automatically — check client notes manually.',
      }])
    } finally {
      setClearing(false)
    }
  }, [clearing, streaming, chatId, onClientsMaybeChanged])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    // Only include user/assistant messages in the history sent to the AI (not system)
    const historyForAI = [...messages.filter(m => m.role !== 'system'), userMsg]
    setMessages(prev => [...prev.filter(m => m.role !== 'system' || prev.indexOf(m) < prev.length), userMsg])
    setInput('')
    setStreaming(true)

    const placeholder: ChatMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, placeholder])

    try {
      const res = await fetch('/api/user/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyForAI,
          today: today(),
          clientId: chatId === 'general' ? null : chatId,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        // Strip SYS_MARKER and everything after it from the live display
        const sysIdx = accumulated.indexOf(SYS_MARKER)
        const displayText = sysIdx !== -1 ? accumulated.slice(0, sysIdx) : accumulated

        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: displayText }
          return next
        })
      }

      // Parse out any system message from the full accumulated text
      const sysIdx = accumulated.indexOf(SYS_MARKER)
      const assistantText = sysIdx !== -1 ? accumulated.slice(0, sysIdx) : accumulated
      const systemText = sysIdx !== -1 ? accumulated.slice(sysIdx + SYS_MARKER.length).trim() : null

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: assistantText }
        if (systemText) next.push({ role: 'system', content: systemText })
        return next
      })

      // Persist both messages atomically (single request avoids race condition)
      fetch(`/api/user/chat/${chatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: trimmed },
            { role: 'assistant', content: assistantText },
          ],
        }),
      }).catch(err => console.error('[chat persist]', err))

      // Refresh client list if the AI updated a record
      if (systemText) onClientsMaybeChanged()
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
        return next
      })
    } finally {
      setStreaming(false)
    }
  }, [messages, streaming, chatId, onClientsMaybeChanged])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showEmpty = historyLoaded && messages.length === 0

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Quick-prompt chips + Clear chat */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#e4e4e7] flex-shrink-0">
        <div className="flex flex-wrap gap-2 flex-1">
          {clientChips.map(chip => (
            <button key={chip} onClick={() => sendMessage(chip)} disabled={streaming || clearing}
              className="px-3 py-1 rounded-full text-xs font-medium bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20 disabled:opacity-50 transition-colors">
              {chip}
            </button>
          ))}
          {globalChips.map(chip => (
            <button key={chip} onClick={() => sendMessage(chip)} disabled={streaming || clearing}
              className="px-3 py-1 rounded-full text-xs font-medium bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7] disabled:opacity-50 transition-colors">
              {chip}
            </button>
          ))}
        </div>
        <button
          onClick={clearChat}
          disabled={clearing || streaming || messages.filter(m => m.role !== 'system').length === 0}
          className="flex-shrink-0 text-[11px] font-medium text-[#a1a1aa] hover:text-[#71717a] disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {clearing ? 'Saving notes…' : 'Clear chat'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {showEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#18181b] mb-1">Your CRM assistant</p>
            <p className="text-xs text-[#71717a] max-w-xs">
              {client
                ? `Ask about ${client.name}, draft a message, or get follow-up advice.`
                : 'Ask about your clients, get follow-up advice, or pick a chip above.'}
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.role === 'system') {
            return (
              <div key={i} className="flex justify-center">
                <span className="text-[11px] italic text-[#a1a1aa] px-3 py-1 bg-[#f4f4f5] rounded-full">
                  {msg.content}
                </span>
              </div>
            )
          }
          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#18181b] text-white rounded-br-sm'
                  : 'bg-[#f4f4f5] text-[#18181b] rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' && msg.content === '' && streaming ? (
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717a] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : msg.role === 'assistant' ? (
                  <div className="prose">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p:      ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        h2:     ({ children }) => <p className="font-semibold text-sm mt-2 mb-0.5">{children}</p>,
                        h3:     ({ children }) => <p className="font-semibold text-sm mt-1.5 mb-0.5">{children}</p>,
                        ul:     ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
                        ol:     ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
                        li:     ({ children }) => <li className="text-sm">{children}</li>,
                        hr:     () => <hr className="my-2 border-[#d4d4d8]" />,
                        code:   ({ children }) => <code className="bg-[#e4e4e7] px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[#e4e4e7] p-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={client ? `Ask about ${client.name}…` : 'Ask about your clients…'}
            rows={1}
            className="flex-1 px-3 py-2.5 rounded-xl border border-[#e4e4e7] text-sm text-[#18181b] bg-white focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] resize-none disabled:opacity-60 placeholder:text-[#a1a1aa]"
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[#18181b] text-white hover:bg-[#27272a] disabled:opacity-40 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-[#a1a1aa] mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}

// ─── Knowledge Editor ─────────────────────────────────────────────────────────

function KnowledgeEditor({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/user/knowledge')
      .then(r => r.json())
      .then((data: { content: string | null }) => setContent(data.content ?? ''))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/user/knowledge', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3">
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-[#e4e4e7] border-t-[#10b981] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            className="flex-1 w-full px-4 py-3 rounded-xl border border-[#e4e4e7] text-sm text-[#18181b] bg-white focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] resize-none font-mono leading-relaxed placeholder:text-[#a1a1aa]"
            placeholder="Add your market knowledge, developer views, investment philosophy…"
          />
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[#71717a] bg-[#f4f4f5] hover:bg-[#e4e4e7] transition-colors"
            >
              Cancel
            </button>
            {saved && (
              <span className="text-xs text-[#10b981] font-medium">Saved</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CRMPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null) // null = General mode
  const [showAdd, setShowAdd] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')
  const [editingKnowledge, setEditingKnowledge] = useState(false)

  const selectedClient = clients.find(c => c.id === selectedId) ?? null
  const chatId = selectedId ?? 'general'

  const loadClients = useCallback(async () => {
    setRefreshing(true)
    try {
      const index = await fetch('/api/user/clients').then(r => r.json()) as IndexEntry[]
      const full = await Promise.all(
        index.map(e => fetch(`/api/user/clients/${e.id}`).then(r => r.json()) as Promise<Client>)
      )
      setClients(sortByFollowUp(full))
    } catch {
      // silently ignore
    } finally {
      setLoaded(true)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  function selectClient(id: string) {
    setSelectedId(id)
    setMobileView('detail')
  }

  function selectGeneral() {
    setSelectedId(null)
    setMobileView('detail')
  }

  function handleClientDeleted() {
    setSelectedId(null)
    loadClients()
  }

  const statusDot = (s: string) => {
    if (s === 'Active') return 'bg-[#10b981]'
    if (s === 'Paused') return 'bg-amber-400'
    return 'bg-zinc-400'
  }

  return (
    <div className="bg-[#fafafa] flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      {showAdd && (
        <AddClientModal onClose={() => setShowAdd(false)} onAdded={loadClients} />
      )}

      {/* Mobile header */}
      <div className="sm:hidden flex-shrink-0 bg-white border-b border-[#e4e4e7] px-4 py-3 flex items-center gap-3">
        {mobileView === 'detail' && (
          <button onClick={() => setMobileView('list')} className="text-[#71717a] hover:text-[#18181b] -ml-1 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="text-base font-semibold text-[#18181b] flex-1">
          {mobileView === 'detail'
            ? (editingKnowledge ? 'Knowledge base' : selectedClient ? selectedClient.name : 'General')
            : `CRM · ${clients.length} clients`}
        </h1>
        {mobileView === 'list' && (
          <button onClick={() => setShowAdd(true)} className="text-xs font-semibold text-[#10b981]">+ Add</button>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className={`
          ${mobileView === 'list' ? 'flex' : 'hidden'} sm:flex
          flex-col w-full sm:w-[280px] bg-white border-r border-[#e4e4e7] flex-shrink-0
        `}>
          {/* Sidebar header — desktop only */}
          <div className="hidden sm:flex items-center justify-between px-4 py-4 border-b border-[#e4e4e7]">
            <div>
              <h1 className="text-sm font-semibold text-[#18181b]">CRM</h1>
              <p className="text-xs text-[#71717a]">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* General chat button */}
          <button
            onClick={selectGeneral}
            className={`flex-shrink-0 w-full text-left px-4 py-3 border-b flex items-center gap-2.5 transition-colors ${
              selectedId === null
                ? 'bg-[#10b981]/5 border-l-2 border-l-[#10b981] border-b-[#e4e4e7]'
                : 'border-b-[#e4e4e7] hover:bg-[#fafafa]'
            }`}
          >
            <svg className={`w-4 h-4 flex-shrink-0 ${selectedId === null ? 'text-[#10b981]' : 'text-[#71717a]'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className={`text-sm font-medium ${selectedId === null ? 'text-[#10b981]' : 'text-[#71717a]'}`}>
              General
            </span>
          </button>

          {/* Client list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {!loaded ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-[#e4e4e7] border-t-[#10b981] rounded-full animate-spin" />
              </div>
            ) : clients.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[#71717a]">No clients yet.</p>
                <button onClick={() => setShowAdd(true)} className="mt-2 text-sm text-[#10b981] font-medium hover:underline">
                  Add your first client
                </button>
              </div>
            ) : (
              clients.map(c => {
                const overdue = isOverdue(c.nextFollowUp)
                const soon = isSoon(c.nextFollowUp)
                const active = selectedId === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => selectClient(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-[#f4f4f5] transition-colors ${
                      active ? 'bg-[#10b981]/5 border-l-2 border-l-[#10b981]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(c.status)}`} />
                      <span className="text-sm font-medium text-[#18181b] truncate flex-1">{c.name}</span>
                      {overdue && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 flex-shrink-0">OVERDUE</span>
                      )}
                      {!overdue && soon && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 flex-shrink-0">SOON</span>
                      )}
                    </div>
                    <div className="pl-4 flex items-center gap-2">
                      {(c.minBudgetAED || c.maxBudgetAED) && (
                        <span className="text-xs text-[#71717a]">
                          {fmtAED(c.minBudgetAED)}
                          {c.minBudgetAED && c.maxBudgetAED ? '–' : ''}
                          {fmtAED(c.maxBudgetAED)}
                        </span>
                      )}
                      {c.nextFollowUp && (
                        <span className={`text-xs ${overdue ? 'text-red-500' : soon ? 'text-amber-600' : 'text-[#a1a1aa]'}`}>
                          {fmtDate(c.nextFollowUp)}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Sidebar footer */}
          <div className="flex flex-col gap-2 p-3 border-t border-[#e4e4e7]">
            <div className="flex gap-2">
              <button
                onClick={loadClients}
                disabled={refreshing}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-[#71717a] bg-[#f4f4f5] hover:bg-[#e4e4e7] disabled:opacity-60 transition-colors"
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={() => setShowAdd(true)}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-[#18181b] hover:bg-[#27272a] transition-colors"
              >
                + Add client
              </button>
            </div>
            <button
              onClick={() => { setEditingKnowledge(true); setMobileView('detail') }}
              className={`w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                editingKnowledge
                  ? 'bg-[#10b981]/10 text-[#10b981]'
                  : 'text-[#71717a] bg-[#f4f4f5] hover:bg-[#e4e4e7]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Knowledge base
            </button>
          </div>
        </aside>

        {/* ── Main area ── */}
        <main className={`
          ${mobileView === 'detail' ? 'flex' : 'hidden'} sm:flex
          flex-col flex-1 min-w-0 min-h-0 overflow-hidden
        `}>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Context header */}
            {editingKnowledge ? (
              <div className="flex-shrink-0 px-5 py-3 border-b border-[#e4e4e7] bg-white flex items-center gap-2">
                <svg className="w-4 h-4 text-[#10b981] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm font-semibold text-[#18181b] leading-tight">Editing knowledge base</p>
              </div>
            ) : selectedClient ? (
              <div className="flex-shrink-0 overflow-y-auto p-4 border-b border-[#e4e4e7]" style={{ maxHeight: '45%' }}>
                <ClientDetail
                  key={selectedClient.id}
                  client={selectedClient}
                  onUpdated={loadClients}
                  onDeleted={handleClientDeleted}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 px-5 py-3 border-b border-[#e4e4e7] bg-white flex items-center gap-2">
                <svg className="w-4 h-4 text-[#10b981] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-[#18181b] leading-tight">General</p>
                  <p className="text-xs text-[#71717a]">Full context on all {clients.length} clients</p>
                </div>
              </div>
            )}

            {/* Main content: knowledge editor or chat panel */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {editingKnowledge ? (
                <KnowledgeEditor onClose={() => setEditingKnowledge(false)} />
              ) : (
                <ChatPanel
                  key={chatId}
                  chatId={chatId}
                  client={selectedClient}
                  onClientsMaybeChanged={loadClients}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
