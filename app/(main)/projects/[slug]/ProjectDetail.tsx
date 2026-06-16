'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Project, PaymentSegment, ProjectInsight } from '@/lib/types'
import { solveIRR, getYearsToCompletion, parseDateToYear, buildAndSolveIRR, computeDealMetrics } from '@/lib/calculations'
import type { PlanRow } from '@/lib/calculations'
import DealBuilder from '@/app/(main)/deals/new/DealBuilder'
import type { InitialValues } from '@/lib/hooks/useCalculator'
import LeadGenForm from '@/components/LeadGenForm'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${Math.round(n / 1000)}k`
}

function fmtHandover(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

function statusLabel(s: string | null) {
  if (!s) return null
  if (s === 'off_plan') return 'Off plan'
  if (s === 'under_construction') return 'Under construction'
  if (s === 'ready') return 'Ready'
  return s
}

function segmentBg(color: PaymentSegment['color']) {
  if (color === 'bronze') return 'var(--brand-bronze)'
  if (color === 'bronze-mid') return 'var(--brand-bronze-mid)'
  return 'var(--brand-bronze-light)'
}

const WHATSAPP = 'https://wa.me/971000000000'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconTrain() {
  return (
    <svg className="w-3.5 h-3.5 text-brand-hint flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 17l-1 3m9-3l1 3M3 12h18M5 12V7a3 3 0 013-3h8a3 3 0 013 3v5M7 17h10a2 2 0 002-2v-3H5v3a2 2 0 002 2z" />
    </svg>
  )
}

function IconPlane() {
  return (
    <svg className="w-3.5 h-3.5 text-brand-hint flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg className="w-3.5 h-3.5 text-brand-hint flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function ConnectivityIcon({ label }: { label: string }) {
  const l = label.toLowerCase()
  if (l.includes('metro') || l.includes('station') || l.includes('train')) return <IconTrain />
  if (l.includes('airport')) return <IconPlane />
  return <IconPin />
}

// ─── Brochure form ────────────────────────────────────────────────────────────

function BrochureForm({ projectSlug }: { projectSlug: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [brochureUrl, setBrochureUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text bg-white focus:outline-none focus:ring-1 focus:ring-brand-bronze focus:border-brand-bronze placeholder:text-brand-hint'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, project_slug: projectSlug }),
      })
      const data = await res.json() as { ok?: boolean; brochure_url?: string | null; error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setBrochureUrl(data.brochure_url ?? null)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (brochureUrl) {
    return (
      <a
        href={brochureUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
        style={{ backgroundColor: '#A0784A' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download brochure
      </a>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row flex-wrap gap-2">
      <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" className={`${inputCls} w-full sm:w-36`} />
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" required placeholder="Email address" className={`${inputCls} w-full sm:w-44`} />
      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone (optional)" className={`${inputCls} w-full sm:w-36`} />
      <button
        type="submit"
        disabled={loading || !name.trim() || !email.trim()}
        className="bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
        style={{ backgroundColor: '#A0784A' }}
      >
        {loading ? 'Sending…' : 'Get brochure'}
      </button>
      {error && <p className="w-full text-xs text-red-500 mt-1">{error}</p>}
    </form>
  )
}

// ─── FAQ accordion ────────────────────────────────────────────────────────────

function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div>
      {faqs.map((faq, i) => {
        const isOpen = open === i
        const isInvestment = /investment|return|yield/i.test(faq.q)
        return (
          <div key={i} className="border-t border-brand-border last:border-b">
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center justify-between py-4 text-left gap-4 cursor-pointer"
            >
              <span className="text-sm font-medium text-brand-text">{faq.q}</span>
              <svg
                className="w-4 h-4 flex-shrink-0 text-brand-bronze transition-transform duration-200"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: isOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.2s ease',
              }}
            >
              <div className="overflow-hidden">
                <p className={`text-sm leading-relaxed pb-4 ${isInvestment ? 'text-brand-hint italic' : 'text-brand-muted'}`}>
                  {faq.a}
                  {isInvestment && (
                    <>{' '}<Link href="/contact" className="text-brand-bronze hover:underline not-italic font-medium">Get in touch for an honest view →</Link></>
                  )}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHandoverDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function adaptPaymentPlan(plans: Project['payment_plans'], handoverDate: string | null): PlanRow[] {
  const plan = plans?.[0]
  if (!plan?.segments?.length) return []
  const handoverFormatted = formatHandoverDate(handoverDate)
  return plan.segments.map((seg, i) => {
    const isHandover = /hand|deliver|complet/i.test(seg.label) || (!!seg.date && seg.date === handoverFormatted)
    const isBooking = /book|sign|reserv|now/i.test(seg.label) || /^on booking$/i.test(seg.date ?? '')
    let date: string
    if (isBooking) {
      date = 'On booking'
    } else if (isHandover) {
      date = handoverFormatted ?? 'On handover'
    } else if (seg.date) {
      date = /^\d{4}$/.test(seg.date) ? `01/${seg.date}` : seg.date
    } else {
      date = 'During construction'
    }
    return { id: `seg-${i}`, label: seg.label, date, pct: seg.percent, ...(isHandover ? { handover: true } : {}) }
  })
}

// ─── Locked analysis panel (public view) ─────────────────────────────────────

function LockedAnalysisPanel({ project }: { project: Project }) {
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: '#1C1B18' }}>
      {/* Blurred mock metrics */}
      <div className="px-8 py-10 select-none" aria-hidden="true">
        <div className="grid sm:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Net yield', value: '6.8%' },
            { label: 'IRR (5yr)', value: '14.2%' },
            { label: 'Total return', value: 'AED 420K' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl p-5">
              <p className="text-white/30 text-xs uppercase tracking-widest mb-2">{label}</p>
              <p className="text-white text-2xl font-bold blur-sm">{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <span className="text-lg font-bold text-emerald-400 blur-sm">A</span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold blur-sm">74 / 100</p>
              <p className="text-white/30 text-xs">Deal score</p>
            </div>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-emerald-500/40 rounded-full" />
          </div>
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-[2px]">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-base">Independent analysis locked</p>
            <p className="text-white/50 text-sm mt-1 max-w-xs">Sign in to see yield, IRR and deal score for {project.name}.</p>
          </div>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(`/projects/${project.slug}`)}`}
            className="bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors mt-1"
            style={{ backgroundColor: '#A0784A' }}
          >
            Sign in to unlock →
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SnapshotValues = InitialValues & { bedrooms?: number | null; typology?: string | null }

// ─── Brochure tab ─────────────────────────────────────────────────────────────

type BrochureDoc = {
  name: string
  sizeBytes: number
  mimeType: string
  signedUrl: string | null
  signError: string | null
}

function fmtSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileLabel(name: string): { display: string; ext: string } {
  const parts = name.split('.')
  const ext = parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE'
  // Replace hyphens/underscores with spaces and title-case for display
  const display = parts.join('.').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return { display, ext }
}

function BrochureTab({ slug }: { slug: string }) {
  const [docs, setDocs] = useState<BrochureDoc[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${slug}/documents`)
      .then(r => r.json() as Promise<BrochureDoc[] | { error: string }>)
      .then(data => {
        if ('error' in data) { setError(data.error); return }
        setDocs(data)
      })
      .catch(() => setError('Failed to load documents.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-brand-bronze border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-center">
        <svg className="w-10 h-10 text-brand-hint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-brand-hint">No documents uploaded for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="py-10">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-6">Documents</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map(doc => {
          const { display, ext } = fileLabel(doc.name)
          const isPdf = doc.mimeType === 'application/pdf' || ext === 'PDF'
          return (
            <div key={doc.name} className="bg-white border border-brand-border rounded-xl p-5 flex flex-col gap-4">
              {/* Icon + name */}
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                  style={{ backgroundColor: isPdf ? '#A0784A' : '#6B7280' }}
                >
                  {ext}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text leading-snug truncate" title={display}>{display}</p>
                  <p className="text-xs text-brand-hint mt-0.5">{fmtSize(doc.sizeBytes)}</p>
                </div>
              </div>

              {/* Open button */}
              {doc.signedUrl ? (
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 border border-brand-border text-brand-text text-xs font-medium px-4 py-2 rounded-lg hover:bg-brand-surface transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
              ) : (
                <p className="mt-auto text-xs text-red-400">
                  {doc.signError ?? 'Unable to generate link'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Secondary pill nav ───────────────────────────────────────────────────────

function SecondaryPillNav({ sections }: { sections: { id: string; label: string; locked?: boolean }[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [slider, setSlider] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-140px 0px -65% 0px', threshold: 0 }
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    const btn = pillRefs.current.get(activeId)
    const container = containerRef.current
    if (btn && container) {
      const containerRect = container.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      setSlider({ left: btnRect.left - containerRect.left, width: btnRect.width })
    }
  }, [activeId, sections])

  function handleClick(id: string) {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (sections.length === 0) return null

  return (
    <div
      className="fixed z-50"
      style={{ bottom: '24px', left: '50%', transform: 'translateX(-50%)' }}
    >
      <div
        ref={containerRef}
        className="relative inline-flex items-center bg-white p-1"
        style={{ borderRadius: '9999px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      >
        <div
          className="absolute top-1 bottom-1"
          style={{
            backgroundColor: '#1C1B18',
            borderRadius: '9999px',
            left: slider.left,
            width: slider.width,
            transition: 'left 0.4s cubic-bezier(0.4, 0.2, 0.2, 1), width 0.4s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}
        />
        {sections.map(({ id, label, locked }) => (
          <button
            key={id}
            ref={el => { if (el) pillRefs.current.set(id, el); else pillRefs.current.delete(id) }}
            onClick={() => handleClick(id)}
            className="relative z-10 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap border-0 bg-transparent transition-colors inline-flex items-center gap-1.5"
            style={{ color: activeId === id ? '#fff' : '#8e8e8e' }}
          >
            {locked && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function outside(e: MouseEvent | TouchEvent) {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [open])

  return (
    <div ref={tipRef} className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen(v => !v)}
        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 leading-none border"
        style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC', color: '#9B9589' }}
        aria-label="More info"
      >
        ?
      </button>
      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 text-xs rounded-lg px-3 py-2.5 shadow-xl z-50 leading-relaxed"
          style={{ backgroundColor: '#1C1B18', color: 'rgba(255,255,255,0.8)', pointerEvents: 'none' }}
        >
          {text}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: '#1C1B18' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-2xl leading-none"
        aria-label="Close"
      >
        ×
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Previous image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image — stopPropagation so clicking the image doesn't close */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Next image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Return analysis panel ────────────────────────────────────────────────────

function ReturnAnalysisPanel({ project, isAuth }: { project: Project; isAuth: boolean }) {
  const unitTypes = project.unit_types ?? []
  const scRate    = project.service_charge_rate ?? 0
  const planRows  = adaptPaymentPlan(project.payment_plans, project.handover_date)
  const completionStr = formatHandoverDate(project.handover_date)

  // ── Unit / bedroom selector ────────────────────────────────────────────────
  const bedroomGroups = [...new Set(unitTypes.map(ut => ut.bedrooms))].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
  const residentialUnits = unitTypes.filter(ut => ut.bedrooms !== null)
  const poolForDefault   = residentialUnits.length > 0 ? residentialUnits : unitTypes
  const sortedByPrice    = [...poolForDefault].sort((a, b) => (a.price_from ?? 0) - (b.price_from ?? 0))
  const midUnit          = sortedByPrice[Math.floor(sortedByPrice.length / 2)] ?? sortedByPrice[0]
  // Use !== undefined so bedrooms=null (commercial units) is preserved rather than falling through ??
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | null>(
    midUnit !== undefined ? midUnit.bedrooms : (bedroomGroups[0] ?? null)
  )
  const unitsInGroup = unitTypes.filter(ut => ut.bedrooms === selectedBedrooms)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(midUnit?.id ?? unitsInGroup[0]?.id ?? '')
  const selectedUnit = unitTypes.find(ut => ut.id === selectedUnitId) ?? unitsInGroup[0]

  const basePrice    = selectedUnit?.price_from ?? project.starting_price ?? 0
  const internalSqft = selectedUnit?.internal_sqft ?? 0
  const balconySqft  = selectedUnit?.balcony_sqft  ?? 0

  function snapRent(v: number) { return Math.min(300_000, Math.max(20_000, Math.round(v / 5_000) * 5_000)) }
  function snapHV(v: number)   { return Math.min(5_000_000, Math.max(300_000, Math.round(v / 50_000) * 50_000)) }

  const [rent,          setRent]          = useState(() => snapRent(selectedUnit?.expected_rent          ?? basePrice * 0.07))
  const [handoverValue, setHandoverValue] = useState(() => snapHV  (selectedUnit?.expected_handover_value ?? basePrice * 1.2))
  const [growth,        setGrowth]        = useState(5)
  const [holdPeriod,    setHoldPeriod]    = useState(5)

  useEffect(() => {
    const unit = unitTypes.find(ut => ut.id === selectedUnitId)
    if (!unit) return
    const p = unit.price_from ?? 0
    setRent(snapRent(unit.expected_rent          ?? p * 0.07))
    setHandoverValue(snapHV(unit.expected_handover_value ?? p * 1.2))
  }, [selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const first = unitTypes.find(ut => ut.bedrooms === selectedBedrooms)
    if (first) setSelectedUnitId(first.id)
  }, [selectedBedrooms]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Financing state ────────────────────────────────────────────────────────
  const [financing,    setFinancing]    = useState<'cash' | 'mortgage'>('cash')
  const handoverRow = planRows.find(r => r.handover) ?? planRows[planRows.length - 1]
  const defaultLtv  = handoverRow
    ? Math.min(80, Math.max(20, Math.round(handoverRow.pct / 5) * 5))
    : 80
  const [ltvPct,       setLtvPct]       = useState(defaultLtv)
  const [mortgageRate, setMortgageRate] = useState(4.5)
  const mortgageOn = financing === 'mortgage'

  // ── Core metrics via computeDealMetrics ────────────────────────────────────
  const metrics = basePrice > 0 ? computeDealMetrics({
    propertyType: 'offplan',
    price:        basePrice,
    rent,
    growth,
    internalSqft,
    balconySqft,
    scRate,
    completion:   completionStr,
    developer:    project.developer?.name ?? '',
    handoverValue,
    paymentPlan:  planRows,
    dldPct:       4,
    agencyFeePct: 0,
    adminFee:     4_200,
    mortgageOn,
    depositPct:   100 - ltvPct,
    interestRate: mortgageRate,
    termYears:    25,
  }) : null

  // ── Derived ────────────────────────────────────────────────────────────────
  const serviceCharge = metrics?.serviceCharge ?? (internalSqft * scRate) + (balconySqft * scRate * 0.25)
  const netIncome     = rent - serviceCharge
  const rawCompYears  = getYearsToCompletion(completionStr)
  const compYears     = Math.max(0, Math.round(rawCompYears ?? 2))

  // ── Payment plan year grouping ─────────────────────────────────────────────
  type YG = { pct: number; aed: number; label: string; isHandover: boolean }
  const ygMap = new Map<string, YG>()
  for (const row of planRows) {
    const yr  = Math.max(0, Math.round(parseDateToYear(row.date, compYears)))
    const key = row.handover ? 'handover' : `yr-${yr}`
    const lbl = row.handover
      ? `Handover (${formatHandoverDate(project.handover_date)})`
      : yr === 0 ? 'Year 0 (now)' : `Year ${yr}`
    const prev = ygMap.get(key)
    const newPct = (prev?.pct ?? 0) + row.pct
    ygMap.set(key, { pct: newPct, aed: (newPct / 100) * basePrice, label: prev?.label ?? lbl, isHandover: !!(row.handover) })
  }
  const yearGroups = [...ygMap.entries()]
    .sort(([a], [b]) => {
      if (a === 'handover') return 1
      if (b === 'handover') return -1
      return parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
    })
    .map(([, v]) => v)

  // Year-5 IRR via buildAndSolveIRR (unleveraged — matches main deal calculator)
  const year5BaseIRR = basePrice > 0 && netIncome > 0 ? buildAndSolveIRR({
    price: basePrice, netIncome, growth, paymentPlan: planRows,
    completion: completionStr, handoverValue, propertyType: 'offplan',
  }) : null

  // ── Exit scenario builder ──────────────────────────────────────────────────
  function buildExitResult(holdYrs: number) {
    const hv = handoverValue > 0 ? handoverValue : basePrice
    if (holdYrs === 0) {
      const n = Math.max(compYears, 1)
      const flows: number[] = new Array(n + 1).fill(0)
      if (planRows.length > 0) {
        for (const row of planRows) {
          const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), n)
          flows[yr] -= basePrice * row.pct / 100
        }
      } else {
        flows[0] -= basePrice
      }
      flows[n] += hv
      return { irr: basePrice > 0 ? solveIRR(flows) : null, exitValue: hv, totalReturn: hv - basePrice, capitalGain: hv - basePrice }
    }
    const exitYr = compYears + holdYrs
    const flows: number[] = new Array(exitYr + 1).fill(0)
    if (planRows.length > 0) {
      for (const row of planRows) {
        const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYr)
        flows[yr] -= basePrice * row.pct / 100
      }
    } else {
      flows[0] -= basePrice
    }
    for (let y = compYears; y < exitYr; y++) flows[y] += netIncome
    const exitValue   = hv * Math.pow(1 + growth / 100, holdYrs)
    const capitalGain = exitValue - basePrice
    const totalReturn = capitalGain + netIncome * holdYrs
    flows[exitYr] += netIncome + exitValue
    return { irr: basePrice > 0 ? solveIRR(flows) : null, exitValue, totalReturn, capitalGain }
  }

  const exitScenarios = [
    { label: 'At handover', holdYrs: 0 },
    { label: 'Year 3',      holdYrs: 3 },
    { label: 'Year 5',      holdYrs: 5 },
    { label: 'Year 10',     holdYrs: 10 },
  ].map(s => {
    const result = buildExitResult(s.holdYrs)
    // Year 5 uses buildAndSolveIRR to match the main deal calculator
    const irr = s.holdYrs === 5 ? year5BaseIRR : result.irr
    return { ...s, ...result, irr }
  })

  // ── Gain on paper ──────────────────────────────────────────────────────────
  const gainOnPaper    = metrics?.gainOnPaper    ?? (handoverValue > basePrice ? handoverValue - basePrice : 0)
  const gainOnPaperPct = metrics?.gainOnPaperPct ?? (basePrice > 0 ? (gainOnPaper / basePrice) * 100 : 0)
  const handoverIRR    = exitScenarios[0].irr

  // ── Financing card details ─────────────────────────────────────────────────
  const dldFee             = basePrice * 0.04
  const adminFee           = 4_200
  const firstSlab          = planRows[0]
  const remainingInstals   = planRows.slice(1)
  const dueAtBooking       = (firstSlab ? (firstSlab.pct / 100) * basePrice : 0) + dldFee + adminFee

  const loanAmount         = metrics?.loanAmount         ?? 0
  const monthlyPayment     = metrics?.monthlyPayment     ?? 0
  const annualMortgageCost = metrics?.annualMortgageCost ?? 0
  const totalInterest      = monthlyPayment * 25 * 12 - loanAmount

  const mRate = mortgageRate / 100 / 12
  function balanceAt(years: number): number {
    if (loanAmount <= 0) return 0
    const months = years * 12
    if (mRate > 0) {
      return Math.max(0, loanAmount * Math.pow(1 + mRate, months)
        - monthlyPayment * (Math.pow(1 + mRate, months) - 1) / mRate)
    }
    return Math.max(0, loanAmount - monthlyPayment * months)
  }

  const hv0 = handoverValue > 0 ? handoverValue : basePrice
  const equityRows = [
    { label: 'Now',                    propValue: basePrice,                             loanBal: loanAmount },
    { label: `Handover (+${compYears}yr)`, propValue: hv0,                              loanBal: balanceAt(compYears) },
    { label: '+3yr post-handover',     propValue: hv0 * Math.pow(1 + growth / 100, 3),  loanBal: balanceAt(compYears + 3) },
    { label: '+5yr post-handover',     propValue: hv0 * Math.pow(1 + growth / 100, 5),  loanBal: balanceAt(compYears + 5) },
    { label: '+10yr post-handover',    propValue: hv0 * Math.pow(1 + growth / 100, 10), loanBal: balanceAt(compYears + 10) },
  ].map(r => ({ ...r, equity: r.propValue - r.loanBal }))

  // ── Break-even ────────────────────────────────────────────────────────────
  const minRent = serviceCharge + (mortgageOn ? annualMortgageCost : 0)

  function findGrowthFor8PctIRR(): number | null {
    const hYrs = holdPeriod > 0 ? holdPeriod : 5
    if (basePrice <= 0) return null
    let lo = 0, hi = 30
    let converged = false
    for (let i = 0; i < 60; i++) {
      const mid    = (lo + hi) / 2
      const exitYr = compYears + hYrs
      const flows: number[] = new Array(exitYr + 1).fill(0)
      if (planRows.length > 0) {
        for (const row of planRows) {
          const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYr)
          flows[yr] -= basePrice * row.pct / 100
        }
      } else {
        flows[0] -= basePrice
      }
      for (let y = compYears; y < exitYr; y++) flows[y] += netIncome
      const hv = handoverValue > 0 ? handoverValue : basePrice
      const ev = hv * Math.pow(1 + mid / 100, hYrs)
      flows[exitYr] += netIncome + ev
      const irr = solveIRR(flows)
      if (irr === null) { lo = mid; continue }
      if (irr < 8) lo = mid; else hi = mid
      if (hi - lo < 0.02) { converged = true; break }
    }
    return converged && hi < 29.9 ? hi : null
  }

  const growthFor8PctIRR = findGrowthFor8PctIRR()

  // ── Scenario computation (Conservative / Base / Optimistic) ─────────────────
  type ScenarioResult =
    | { mode: 'flip'; netYield: number; gainOnPaper: number; scenarioHV: number; returnOnCapital: number }
    | { mode: 'hold'; netYield: number; irr: number | null; valueAtExit: number; totalReturn: number }

  function computeScenario(rentMult: number, growthMult: number, hvMult = 1.0): ScenarioResult {
    const sRent      = rent * rentMult
    const sGrowth    = growth * growthMult
    const sHV        = handoverValue * hvMult
    const sNetIncome = sRent - serviceCharge
    const sNetYield  = basePrice > 0 ? (sNetIncome / basePrice) * 100 : 0

    if (holdPeriod === 0) {
      const gainOnPaper      = sHV - basePrice
      const totalDeployed    = basePrice + dldFee + adminFee
      const returnOnCapital  = totalDeployed > 0 ? (gainOnPaper / totalDeployed) * 100 : 0
      return { mode: 'flip', netYield: sNetYield, gainOnPaper, scenarioHV: sHV, returnOnCapital }
    }

    const exitYear = compYears + holdPeriod
    const flows: number[] = new Array(exitYear + 1).fill(0)
    if (planRows.length > 0) {
      for (const row of planRows) {
        const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYear)
        flows[yr] -= basePrice * row.pct / 100
      }
    } else {
      flows[0] -= basePrice
    }
    for (let y = compYears; y < exitYear; y++) flows[y] += sNetIncome
    const exitBase  = sHV > 0 ? sHV : basePrice
    const exitValue = exitBase * Math.pow(1 + sGrowth / 100, holdPeriod)
    flows[exitYear] += sNetIncome + exitValue

    const irr         = solveIRR(flows)
    const totalReturn = sNetIncome * holdPeriod + (exitValue - basePrice)
    return { mode: 'hold', netYield: sNetYield, irr, valueAtExit: exitValue, totalReturn }
  }

  const conservative = holdPeriod === 0 ? computeScenario(1,    1,    0.925) : computeScenario(0.85, 0.85)
  const base         =                    computeScenario(1,    1,    1)
  const optimistic   = holdPeriod === 0 ? computeScenario(1,    1,    1.075) : computeScenario(1.15, 1.15)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtA(n: number): string {
    const abs  = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    if (abs >= 1_000_000) return `${sign}AED ${(abs / 1_000_000).toFixed(2)}M`
    if (abs >= 1_000)     return `${sign}AED ${Math.round(abs / 1_000)}k`
    return `${sign}AED ${Math.round(abs).toLocaleString()}`
  }
  function fmtP(n: number | null): string {
    if (n === null) return '—'
    return `${n.toFixed(1)}%`
  }
  function bedroomLabel(b: number | null) {
    if (b === null) return 'Commercial'
    if (b === 0)    return 'Studio'
    return `${b} Bed`
  }

  const PILL      = 'px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border flex flex-col items-center leading-none'
  const PILL_ON   = `${PILL} bg-[#18181b] text-white border-[#18181b]`
  const PILL_OFF  = `${PILL} bg-white text-brand-muted border-brand-border hover:border-brand-text hover:text-brand-text`
  const SPILL_ON  = `${PILL} text-[11px] border-brand-bronze text-white`
  const SPILL_OFF = `${PILL} text-[11px] bg-brand-surface border-brand-border text-brand-muted hover:text-brand-text`

  // Lowest price per bedroom group, for display in each group pill
  const minPriceByGroup = new Map<number | null, number | null>()
  for (const b of bedroomGroups) {
    const prices = unitTypes.filter(ut => ut.bedrooms === b).map(ut => ut.price_from).filter((p): p is number => p !== null)
    minPriceByGroup.set(b, prices.length > 0 ? Math.min(...prices) : null)
  }
  const minSqftByGroup = new Map<number | null, number | null>()
  for (const b of bedroomGroups) {
    const sqfts = unitTypes.filter(ut => ut.bedrooms === b).map(ut => ut.internal_sqft).filter((s): s is number => s != null)
    minSqftByGroup.set(b, sqfts.length > 0 ? Math.min(...sqfts) : null)
  }

  if (unitTypes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-brand-hint">No unit types have been added to this project yet.</p>
      </div>
    )
  }

  const secondaryNavSections = [
    { id: 'unit-selection', label: 'Unit Selection' },
    { id: 'inputs',         label: 'Inputs' },
    ...(yearGroups.length > 0 ? [{ id: 'payment-plan', label: 'Payment plan' }] : []),
    { id: 'scenarios',     label: 'Scenarios',     locked: !isAuth },
    { id: 'financing',     label: 'Financing',     locked: !isAuth },
    { id: 'exit-analysis', label: 'Exit analysis', locked: !isAuth },
  ]

  // ── Shared Return Analysis content blocks ───────────────────────────────────
  const financingHeader = (
    <div className="flex items-center justify-between mb-5">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium">Financing</p>
      <div className="flex rounded-lg border border-brand-border overflow-hidden text-xs font-medium">
        <button
          onClick={() => setFinancing('cash')}
          className={`px-4 py-2 transition-colors ${financing === 'cash' ? 'text-white' : 'text-brand-muted hover:text-brand-text'}`}
          style={financing === 'cash' ? { backgroundColor: '#1C1B18' } : {}}
        >
          Cash
        </button>
        <button
          onClick={() => setFinancing('mortgage')}
          className={`px-4 py-2 transition-colors border-l border-brand-border ${financing === 'mortgage' ? 'text-white' : 'text-brand-muted hover:text-brand-text'}`}
          style={financing === 'mortgage' ? { backgroundColor: '#1C1B18' } : {}}
        >
          Mortgage
        </button>
      </div>
    </div>
  )

  const dueAtBookingCard = firstSlab && basePrice > 0 ? (
    <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: '#F4F3F0' }}>
      <p className="text-xs font-semibold text-brand-text mb-2">Due at booking</p>
      <div className="flex justify-between text-xs">
        <span className="text-brand-muted">{firstSlab.label} ({firstSlab.pct}%)</span>
        <span className="font-medium text-brand-text">{fmtA((firstSlab.pct / 100) * basePrice)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-brand-muted">DLD (4%)</span>
        <span className="font-medium text-brand-text">{fmtA(dldFee)}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-brand-muted">Admin fee</span>
        <span className="font-medium text-brand-text">{fmtA(adminFee)}</span>
      </div>
      <div className="border-t border-brand-border pt-2 flex justify-between text-xs font-semibold">
        <span className="text-brand-text">Total due now</span>
        <span className="text-brand-text">{fmtA(dueAtBooking)}</span>
      </div>
    </div>
  ) : null

  const financingRemainder = (
    <>
      {remainingInstals.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-medium text-brand-muted mb-2">Remaining instalments</p>
          <div className="space-y-1.5">
            {remainingInstals.map((row, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-brand-hint">{row.label} · {row.date}</span>
                <span className="font-medium text-brand-text">{fmtA((row.pct / 100) * basePrice)} ({row.pct}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mortgageOn && (
        <div className="space-y-5 border-t border-brand-border pt-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-brand-muted">LTV (loan to value)</span>
                <Tooltip text="Percentage of the property value financed by the mortgage. UAE max is typically 75% for expats." />
              </div>
              <span className="text-sm font-semibold text-brand-text">{ltvPct}%</span>
            </div>
            <input type="range" min={20} max={80} step={5} value={ltvPct}
              onChange={e => setLtvPct(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-brand-hint">20%</span>
              <span className="text-xs text-brand-hint">80%</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-brand-muted">Interest rate</span>
                <Tooltip text="Annual mortgage interest rate. UAE rates typically range from 3.5% to 6%." />
              </div>
              <span className="text-sm font-semibold text-brand-text">{mortgageRate.toFixed(1)}%</span>
            </div>
            <input type="range" min={2} max={10} step={0.25} value={mortgageRate}
              onChange={e => setMortgageRate(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-brand-hint">2%</span>
              <span className="text-xs text-brand-hint">10%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
              <p className="text-[10px] text-brand-hint mb-1">Loan amount</p>
              <p className="text-sm font-semibold text-brand-text">{fmtA(loanAmount)}</p>
            </div>
            <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
              <p className="text-[10px] text-brand-hint mb-1">Monthly payment</p>
              <p className="text-sm font-semibold text-brand-text">{fmtA(monthlyPayment)}</p>
            </div>
            <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
              <p className="text-[10px] text-brand-hint mb-1">Annual mortgage cost</p>
              <p className="text-sm font-semibold text-brand-text">{fmtA(annualMortgageCost)}</p>
            </div>
            <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
              <p className="text-[10px] text-brand-hint mb-1">Total interest (25yr)</p>
              <p className="text-sm font-semibold text-brand-text">{totalInterest > 0 ? fmtA(totalInterest) : '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-brand-muted mb-2">Equity build-up</p>
            <div className="rounded-lg overflow-hidden border border-brand-border">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#F4F3F0' }}>
                    <th className="text-left px-3 py-2 text-brand-hint font-medium">Period</th>
                    <th className="text-right px-3 py-2 text-brand-hint font-medium">Value</th>
                    <th className="text-right px-3 py-2 text-brand-hint font-medium">Loan</th>
                    <th className="text-right px-3 py-2 text-brand-hint font-medium">Equity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {equityRows.map((r, i) => (
                    <tr key={i} className="bg-white">
                      <td className="px-3 py-2 text-brand-muted">{r.label}</td>
                      <td className="px-3 py-2 text-right text-brand-text font-medium">{fmtA(r.propValue)}</td>
                      <td className="px-3 py-2 text-right text-brand-hint">{fmtA(r.loanBal)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600">{fmtA(r.equity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className={`border-t border-brand-border pt-5${mortgageOn ? '' : ' mt-0'}`}>
        <p className="text-xs font-medium text-brand-muted mb-3">Break-even analysis</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] text-brand-hint">Min. annual rent</p>
              <Tooltip text={mortgageOn
                ? 'Minimum rent to cover service charge and annual mortgage payments.'
                : 'Minimum rent to cover the service charge (net income = 0).'} />
            </div>
            <p className="text-sm font-semibold text-brand-text">{minRent > 0 ? fmtA(minRent) : '—'}</p>
            {minRent > 0 && rent > 0 && (
              <p className={`text-[10px] mt-0.5 ${rent >= minRent ? 'text-emerald-600' : 'text-red-500'}`}>
                {rent >= minRent
                  ? `AED ${(rent - minRent).toLocaleString()} headroom`
                  : `AED ${(minRent - rent).toLocaleString()} shortfall`}
              </p>
            )}
          </div>
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] text-brand-hint">Growth for 8% IRR</p>
              <Tooltip text="Annual capital growth needed to achieve an 8% IRR over your selected hold period." />
            </div>
            <p className="text-sm font-semibold text-brand-text">
              {growthFor8PctIRR !== null ? `${growthFor8PctIRR.toFixed(1)}%` : '> 30%'}
            </p>
            {growthFor8PctIRR !== null && (
              <p className={`text-[10px] mt-0.5 ${growth >= growthFor8PctIRR ? 'text-emerald-600' : 'text-amber-600'}`}>
                {growth >= growthFor8PctIRR
                  ? 'Met at current assumption'
                  : `Need +${(growthFor8PctIRR - growth).toFixed(1)}% pa`}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  )

  const exitAnalysisContent = (
    <>
      {basePrice > 0 && handoverValue > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Gain on paper at handover</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">Gain on paper</span>
                <Tooltip text="Estimated value at handover minus your purchase price. Not realised until you sell." />
              </div>
              <p className={`text-lg font-bold ${gainOnPaper >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {gainOnPaper >= 0 ? '+' : ''}{fmtA(gainOnPaper)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">vs. purchase price</span>
                <Tooltip text="Gain on paper as a percentage of your purchase price." />
              </div>
              <p className={`text-lg font-bold ${gainOnPaperPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {gainOnPaperPct >= 0 ? '+' : ''}{fmtP(gainOnPaperPct)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">IRR to handover</span>
                <Tooltip text="Annualised return from purchase to handover, accounting for the staggered payment plan." />
              </div>
              <p className={`text-lg font-bold ${(handoverIRR ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {handoverIRR !== null ? `${handoverIRR >= 0 ? '+' : ''}${fmtP(handoverIRR)}` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Exit scenarios</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {exitScenarios.map(s => {
            const isActive = holdPeriod === s.holdYrs
            return (
              <div
                key={s.holdYrs}
                className={`rounded-xl border p-5 transition-all ${isActive ? '' : 'bg-white border-brand-border'}`}
                style={isActive ? { borderColor: '#A0784A', backgroundColor: '#FDFCF9' } : {}}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-brand-text">{s.label}</p>
                  {isActive && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#A0784A' }}>
                      Selected
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">Exit value</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtA(s.exitValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">Total return</p>
                    <p className={`text-sm font-semibold ${s.totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.totalReturn >= 0 ? '+' : ''}{fmtA(s.totalReturn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">IRR</p>
                    <p className={`text-sm font-bold ${(s.irr ?? 0) >= 8 ? 'text-emerald-600' : (s.irr ?? 0) >= 0 ? 'text-brand-text' : 'text-red-500'}`}>
                      {s.irr !== null ? fmtP(s.irr) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  const lockCTA = (
    <div className="rounded-2xl border border-brand-border bg-white p-8 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: '#F4F3F0' }}>
        <svg className="w-6 h-6 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-text mb-2">Full breakdown locked</p>
        <p className="text-xs text-brand-muted leading-relaxed">
          Financing, scenario modelling and exit analysis — all in one place. Available to registered clients only.
        </p>
      </div>
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-colors"
        style={{ backgroundColor: '#A0784A' }}
      >
        Enquire for access →
      </Link>
    </div>
  )

  return (
    <div className="py-10 space-y-8">

      <SecondaryPillNav sections={secondaryNavSections} />

      {/* ── 1. Unit selection ─────────────────────────────────────────────── */}
      <div id="unit-selection">
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Select unit</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {bedroomGroups.map(b => {
            const active = selectedBedrooms === b
            const muted = active ? 'text-white/60' : 'text-brand-hint'
            const sqft = minSqftByGroup.get(b)
            return (
              <button key={String(b)} onClick={() => setSelectedBedrooms(b)}
                className={active ? PILL_ON : PILL_OFF}>
                <span>{bedroomLabel(b)}</span>
                <span className={`text-[10px] font-normal mt-0.5 ${muted}`}>
                  From {fmtPrice(minPriceByGroup.get(b) ?? null)}
                </span>
                {sqft != null && (
                  <span className={`text-[9px] font-normal mt-0.5 ${muted}`}>
                    {sqft.toLocaleString()} sqft
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {unitsInGroup.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {unitsInGroup.map(ut => {
              const active = selectedUnitId === ut.id
              const muted = active ? 'text-white/60' : 'text-brand-hint'
              return (
                <button key={ut.id} onClick={() => setSelectedUnitId(ut.id)}
                  className={active ? SPILL_ON : SPILL_OFF}
                  style={active ? { backgroundColor: '#A0784A' } : {}}>
                  <span>{ut.typology ?? ut.type}</span>
                  <span className={`text-[10px] font-normal mt-0.5 ${muted}`}>
                    From {fmtPrice(ut.price_from)}
                  </span>
                  {ut.internal_sqft != null && (
                    <span className={`text-[9px] font-normal mt-0.5 ${muted}`}>
                      {ut.internal_sqft.toLocaleString()} sqft
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 2. Inputs ─────────────────────────────────────────────────────── */}
      <div id="inputs" className="bg-white rounded-xl border border-brand-border p-5 space-y-6">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-brand-muted"
          style={{ backgroundColor: '#F4F3F0' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Estimated — adjust to explore scenarios
        </span>

        {/* Rent */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Expected annual rent</span>
            <span className="text-sm font-semibold text-brand-text">AED {rent.toLocaleString()}</span>
          </div>
          <input type="range" min={20_000} max={300_000} step={5_000} value={rent}
            onChange={e => setRent(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">AED 20k</span>
            <span className="text-xs text-brand-hint">AED 300k</span>
          </div>
        </div>

        {/* Handover value */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Est. value at handover</span>
            <span className="text-sm font-semibold text-brand-text">{fmtA(handoverValue)}</span>
          </div>
          <input type="range" min={300_000} max={5_000_000} step={50_000} value={handoverValue}
            onChange={e => setHandoverValue(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">AED 300k</span>
            <span className="text-xs text-brand-hint">AED 5M</span>
          </div>
        </div>

        {/* Growth */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Annual capital growth (post-handover)</span>
            <span className="text-sm font-semibold text-brand-text">{growth.toFixed(1)}%</span>
          </div>
          <input type="range" min={0} max={15} step={0.5} value={growth}
            onChange={e => setGrowth(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">0%</span>
            <span className="text-xs text-brand-hint">15%</span>
          </div>
        </div>

        {/* Hold period */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Hold period from handover</span>
            <span className="text-sm font-semibold text-brand-text">
              {holdPeriod === 0 ? 'Sell at handover' : `${holdPeriod} yr${holdPeriod > 1 ? 's' : ''}`}
            </span>
          </div>
          <input type="range" min={0} max={15} step={1} value={holdPeriod}
            onChange={e => setHoldPeriod(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">0 yrs = sell at handover</span>
            <span className="text-xs text-brand-hint">15 yrs</span>
          </div>
        </div>
      </div>

      {/* ── 3. Payment plan ───────────────────────────────────────────────── */}
      {yearGroups.length > 0 && (
        <div id="payment-plan" className="bg-white rounded-xl border border-brand-border p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium">Payment plan</p>
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
              project.payment_plan_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {project.payment_plan_confirmed ? 'Confirmed' : 'Indicative'}
            </span>
          </div>
          <div className="space-y-2.5">
            {yearGroups.map((g, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className={`text-xs ${g.isHandover ? 'font-semibold text-brand-text' : 'text-brand-muted'}`}>
                  {g.label}
                </span>
                <div className="text-right">
                  <span className={`text-xs font-semibold ${g.isHandover ? '' : 'text-brand-text'}`}
                    style={g.isHandover ? { color: '#A0784A' } : {}}>
                    {g.pct}%
                  </span>
                  {basePrice > 0 && (
                    <span className="text-xs text-brand-hint ml-2">{fmtA(g.aed)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4-6. Scenarios / Financing / Exit analysis ──────────────────────── */}
      <div className="space-y-8">

        {/* ── 4. Scenarios ──────────────────────────────────────────────── */}
        <div id="scenarios">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Scenarios</p>
          <div className="grid sm:grid-cols-3 gap-4">
            {([
              { label: 'Conservative', metrics: conservative, highlighted: false },
              { label: 'Base',         metrics: base,         highlighted: true  },
              { label: 'Optimistic',   metrics: optimistic,   highlighted: false },
            ] as const).map(({ label, metrics: m, highlighted }) => (
              <div key={label}
                className={`bg-white rounded-xl border p-5 ${highlighted ? '' : 'border-brand-border'}`}
                style={highlighted ? { borderColor: '#A0784A' } : {}}>
                <div className={`flex items-center justify-between mb-4 ${!isAuth ? 'blur-sm select-none' : ''}`}>
                  <p className="text-xs font-semibold text-brand-muted">{label}</p>
                  {highlighted && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#A0784A' }}>
                      Base case
                    </span>
                  )}
                </div>
                {m.mode === 'hold' ? (
                  <div className="space-y-3">
                    <div className={!isAuth && !highlighted ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Net yield</p>
                      <p className="text-lg font-semibold text-brand-text">{fmtP(m.netYield)}</p>
                    </div>
                    <div className={!isAuth ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Value at exit</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.valueAtExit)}</p>
                    </div>
                    <div className={!isAuth ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Total return</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.totalReturn)}</p>
                    </div>
                    {m.irr !== null && (
                      <div className={`pt-2 border-t border-brand-border ${!isAuth ? 'blur-sm select-none' : ''}`}>
                        <p className="text-xs text-brand-hint mb-0.5">IRR</p>
                        <p className="text-base font-bold text-brand-text">{fmtP(m.irr)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`space-y-3 ${!isAuth ? 'blur-sm select-none' : ''}`}>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Gain on paper</p>
                      <p className="text-lg font-semibold text-brand-text">{fmtA(m.gainOnPaper)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Est. value at handover</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.scenarioHV)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Return on capital</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtP(m.returnOnCapital)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-hint mt-2.5">
            {holdPeriod === 0
              ? 'Conservative assumes 7.5% below estimated handover value. Optimistic assumes 7.5% above.'
              : 'Conservative assumes 15% lower rent and growth than base estimate. Optimistic assumes 15% higher.'}
          </p>
        </div>

        {isAuth ? (
          <>
            {/* ── 5. Financing ─────────────────────────────────────────── */}
            <div id="financing" className="bg-white rounded-xl border border-brand-border p-5">
              {financingHeader}
              {dueAtBookingCard && <div className="mb-5">{dueAtBookingCard}</div>}
              {financingRemainder}
            </div>

            {/* ── 6. Exit analysis ─────────────────────────────────────── */}
            <div id="exit-analysis" className="space-y-8">
              {exitAnalysisContent}
            </div>
          </>
        ) : (
          <>
            {/* Full-width divider */}
            <div className="border-t border-brand-border" />

            {/* ── 5. Financing — Due at booking (visible) ─────────────────── */}
            <div id="financing" className="bg-white rounded-xl border border-brand-border p-5">
              <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Financing</p>
              {dueAtBookingCard}
            </div>

            {/* Full-width divider */}
            <div className="border-t border-brand-border" />

            {/* ── Lock CTA — in-flow block ─────────────────────────────────── */}
            {lockCTA}

            {/* ── Locked content: remaining financing + exit analysis ──────── */}
            <div className="blur-sm pointer-events-none select-none space-y-8">
              <div className="bg-white rounded-xl border border-brand-border p-5">
                {financingHeader}
                {financingRemainder}
              </div>

              <div id="exit-analysis" className="space-y-8">
                {exitAnalysisContent}
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectDetail({
  project,
  insight,
  isAdmin = false,
  snapshotValues,
}: {
  project: Project
  insight?: ProjectInsight
  isAdmin?: boolean
  snapshotValues?: SnapshotValues
}) {
  const isAuth = !!insight

  // Auth tab state
  const [authTab, setAuthTab] = useState<'overview' | 'returns' | 'brochure'>('overview')

  // Public tab state
  const [pubTab, setPubTab] = useState<'overview' | 'returns' | 'brochure'>('overview')

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const scrollNavRef = useRef<HTMLDivElement | null>(null)

  // Documents tab state
  const [activeDocTab, setActiveDocTab] = useState(0)

  // Insight-derived flags
  const hasMytake = !!(insight?.insight_opinion || insight?.insight_projections || insight?.insight_risks)
  const documents = insight?.documents ?? []
  const hasDocs   = documents.length > 0

  // Map stored DealParamsPayload fields (from insight.defaultParams) to InitialValues keys
  function applyDefaultParams(dp: Record<string, unknown>): Partial<InitialValues & { bedrooms?: number | null; typology?: string | null }> {
    const out: Partial<InitialValues & { bedrooms?: number | null; typology?: string | null }> = {}
    if (dp.price        != null) out.price        = dp.price        as number
    if (dp.rent         != null) out.rent         = dp.rent         as number
    if (dp.growth       != null) out.growth       = dp.growth       as number
    if (dp.handoverValue != null) out.handoverValue = dp.handoverValue as number
    if (dp.propertySubType) out.propertySubType = dp.propertySubType as 'apartment' | 'townhouse' | 'villa'
    if (dp.internalSqft != null) out.internalSqft = dp.internalSqft as number
    if (dp.balconySqft  != null) out.balconySqft  = dp.balconySqft  as number
    if (dp.buaSqft      != null) out.buaSqft      = dp.buaSqft      as number
    if (dp.plotSqft     != null) out.plotSqft     = dp.plotSqft     as number
    if (dp.serviceCharge != null) out.scRate       = dp.serviceCharge as number
    if (dp.completion)  out.completion = dp.completion as string
    if (dp.view)        out.view       = dp.view       as string
    if (dp.unit)        out.unit       = dp.unit       as string
    if (dp.emirate)     out.emirate    = dp.emirate    as 'Dubai' | 'Abu Dhabi'
    if (dp.location)    out.location   = dp.location   as string
    if (dp.dld          != null) out.dldPct       = dp.dld          as number
    if (dp.agencyFee    != null) out.agencyFeePct = dp.agencyFee    as number
    if (dp.adminFee     != null) out.adminFee     = dp.adminFee     as number
    if (dp.mortgageOn   != null) out.mortgageOn   = dp.mortgageOn   as boolean
    if (dp.depositPct   != null) out.depositPct   = dp.depositPct   as number
    if (dp.interestRate != null) out.interestRate = dp.interestRate as number
    if (dp.termYears    != null) out.termYears    = dp.termYears    as number
    if (dp.mortgageType) out.mortgageType = dp.mortgageType as 'repayment' | 'interest-only'
    if (dp.paymentPlan) { try { out.paymentPlan = JSON.parse(dp.paymentPlan as string) as PlanRow[] } catch { /* ignore */ } }
    if (dp.bedrooms !== undefined) out.bedrooms = dp.bedrooms as number | null
    if (dp.typology) out.typology = dp.typology as string
    return out
  }

  // Calculator initial values
  const calcInitialValues: (InitialValues & { bedrooms?: number | null; typology?: string | null }) | undefined = insight ? {
    price:       project.starting_price ?? 0,
    completion:  formatHandoverDate(project.handover_date),
    developer:   project.developer?.name ?? '',
    developerId: project.developer_id,
    projectSlug: project.slug,
    project:     project.name,
    propertyType: 'offplan',
    paymentPlan: adaptPaymentPlan(project.payment_plans, project.handover_date),
    ...(insight.defaultParams ? applyDefaultParams(insight.defaultParams) : {}),
    ...snapshotValues,
  } : undefined


  const hero = project.images?.[0] ?? null
  const images = project.images ?? []
  const plans = project.payment_plans ?? []
  const connectivity = project.connectivity ?? []
  const amenities = project.amenities ?? []
  const faqs = project.faqs ?? []
  const unitTypes = project.unit_types ?? []
  const firstPlan = plans[0]

  const overviewNavSections = [
    { id: 'about', label: 'About' },
    ...(unitTypes.length > 0 ? [{ id: 'units', label: 'Units' }] : []),
    ...(plans.length > 0 ? [{ id: 'payment-plan', label: 'Payment plan' }] : []),
    ...(connectivity.length > 0 ? [{ id: 'location', label: 'Location' }] : []),
    ...(faqs.length > 0 ? [{ id: 'faq', label: 'FAQ' }] : []),
  ]

  // ─── Shared section content ────────────────────────────────────────────────

  const aboutSection = (
    <section id="about" className="py-16">
      <div className="grid md:grid-cols-5 gap-10 md:gap-16 items-start">
        {/* Left column: About text + Units (~60%) — stacks first on mobile */}
        <div className="md:col-span-3">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">About</p>
          {project.description ? (
            <p className="text-sm text-brand-muted leading-relaxed">{project.description}</p>
          ) : (
            <p className="text-sm text-brand-hint">No description available.</p>
          )}

          {unitTypes.length > 0 && (
            <div id="units" className="border-t border-brand-border pt-10 mt-10">
              <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Units</p>
              <div className="grid grid-cols-2 gap-3">
                {unitTypes.map(ut => (
                  <div key={ut.id} className="bg-white border border-brand-border rounded-xl p-5">
                    <p className="text-sm font-medium text-brand-text">{ut.type}</p>
                    <p className="text-xl font-medium text-brand-bronze mt-1">{fmtPrice(ut.price_from)}</p>
                    <div className="border-t border-brand-border my-3" />
                    <p className="text-xs text-brand-hint">{ut.size_sqft_from.toLocaleString()} sqft</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Lead gen form (~40%) — stacks last on mobile */}
        <div className="md:col-span-2 md:sticky md:top-[132px]">
          <div className="rounded-xl border border-brand-border bg-white p-6">
            <p className="text-sm font-semibold text-brand-text mb-1">Get independent advice</p>
            <p className="text-xs text-brand-muted mb-5">Analysis and advice from an independent buyer's agent.</p>
            <LeadGenForm
              projectName={project.name}
              onSubmit={(data) => {
                // TODO: wire to submission endpoint (Supabase insert or API route)
                console.log('LeadGenForm submission:', data)
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )

  const galleryImages = images.slice(1)

  const gallerySection = (
    <section id="gallery" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Gallery</p>
      {galleryImages.length > 0 ? (
        <div className="grid grid-cols-4 grid-rows-[200px_200px] gap-2">
          <div
            className="col-span-2 row-span-2 rounded-xl overflow-hidden bg-brand-surface cursor-pointer"
            onClick={() => setLightboxIndex(1)}
          >
            <img src={galleryImages[0]} alt="" className="w-full h-full object-cover object-center" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`rounded-xl overflow-hidden bg-brand-surface flex items-center justify-center ${galleryImages[i] ? 'cursor-pointer' : ''}`}
              onClick={() => galleryImages[i] && setLightboxIndex(i + 1)}
            >
              {galleryImages[i] ? (
                <img src={galleryImages[i]} alt="" className="w-full h-full object-cover object-center" />
              ) : (
                <svg className="w-5 h-5 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="h-64 rounded-xl bg-brand-surface flex items-center justify-center">
          <p className="text-sm text-brand-hint">No images yet</p>
        </div>
      )}
    </section>
  )

  const paymentPlanSection = plans.length > 0 ? (
    <section id="payment-plan" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Payment plan</p>
      <div className="space-y-4">
        {plans.map((plan, i) => (
          <div key={i} className="bg-white border border-brand-border rounded-xl p-5">
            <p className="text-sm font-medium text-brand-text mb-3">{plan.name}</p>
            <div className="h-1.5 rounded-full overflow-hidden flex mb-3">
              {plan.segments.map((seg, j) => (
                <div
                  key={j}
                  style={{ width: `${seg.percent}%`, backgroundColor: segmentBg(seg.color) }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {plan.segments.map((seg, j) => (
                <div key={j} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: segmentBg(seg.color) }} />
                  <span className="text-xs text-brand-hint">{seg.label} · {seg.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null

  const locationSection = connectivity.length > 0 ? (
    <section id="location" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Location</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {connectivity.map((item, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC' }}>
            <ConnectivityIcon label={item.label} />
            <span className="text-sm text-brand-muted truncate">{item.label}</span>
            <span className="ml-auto text-xs font-medium text-brand-bronze flex-shrink-0">{item.time}</span>
          </div>
        ))}
      </div>
      {/* Amenities inline */}
      {amenities.length > 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Amenities</p>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a, i) => (
              <span key={i} className="bg-brand-surface border border-brand-border rounded-full px-3 py-1 text-xs text-brand-muted" style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC' }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  ) : null

  const faqSection = faqs.length > 0 ? (
    <section id="faq" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">FAQ</p>
      <FaqAccordion faqs={faqs} />
    </section>
  ) : null

  const developerSection = project.developer ? (
    <section className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Developer</p>
      <div className="bg-white border border-brand-border rounded-xl p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-lg bg-brand-text flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#1C1B18' }}>
          {project.developer.logo_url ? (
            <img src={project.developer.logo_url} alt={project.developer.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-white text-xs font-semibold">{project.developer.name.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-text">{project.developer.name}</p>
          {project.developer.description && (
            <p className="text-xs text-brand-hint leading-relaxed mt-1">{project.developer.description}</p>
          )}
          <div className="flex flex-wrap gap-5 mt-3">
            {project.developer.founded_year && (
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-hint">Founded</p>
                <p className="text-xs font-medium text-brand-text mt-0.5">{project.developer.founded_year}</p>
              </div>
            )}
            {project.developer.portfolio_value && (
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-hint">Portfolio</p>
                <p className="text-xs font-medium text-brand-text mt-0.5">{project.developer.portfolio_value}</p>
              </div>
            )}
          </div>
          <Link
            href={`/developers/${project.developer.slug}`}
            className="text-xs text-brand-bronze hover:underline mt-2 inline-block"
          >
            View all projects →
          </Link>
        </div>
      </div>
    </section>
  ) : null

  // ─── My Take section (auth) ───────────────────────────────────────────────

  const myTakeSection = hasMytake ? (
    <section className="py-10">
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#1C1B18' }}>
        <div className="px-8 py-5 border-b border-white/10 flex items-center gap-2.5">
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#A0784A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A0784A' }}>Independent Analysis</span>
        </div>
        <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {insight?.insight_opinion && (
            <div className="px-8 py-7">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-3">Opinion</p>
              <p className="text-sm text-white/75 leading-relaxed">{insight.insight_opinion}</p>
            </div>
          )}
          {insight?.insight_projections && (
            <div className="px-8 py-7">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 mb-3">Projections</p>
              <p className="text-sm text-white/75 leading-relaxed">{insight.insight_projections}</p>
            </div>
          )}
          {insight?.insight_risks && (
            <div className="px-8 py-7">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgb(251 191 36 / 0.6)' }}>Risks</p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgb(255 255 255 / 0.65)' }}>{insight.insight_risks}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  ) : null

  // ─── Hero ─────────────────────────────────────────────────────────────────

  const heroEl = (
    <div className="relative bg-brand-text overflow-hidden flex flex-col justify-end" style={{ backgroundColor: '#1C1B18', aspectRatio: '16/9', maxHeight: 600, width: '100%' }}>
      {hero && (
        <img src={hero} alt={project.name} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Status badge */}
      {project.status && (
        <div className="absolute top-6 left-6 sm:left-10">
          <span className="bg-brand-bronze text-white text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: '#A0784A' }}>
            {statusLabel(project.status)}
          </span>
        </div>
      )}

      {/* Title block */}
      <div className="relative px-6 sm:px-10 pb-6 max-w-5xl mx-auto w-full">
        <p className="hidden md:block text-brand-bronze-mid text-xs tracking-widest uppercase mb-2">{project.developer?.name}</p>
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-medium text-white leading-tight mb-3">{project.name}</h1>
        {project.location && (
          <p className="text-xs sm:text-sm text-white/50 mb-4">{project.location}{project.community ? ` · ${project.community}` : ''}</p>
        )}

        {/* Stat pills */}
        <div className="flex flex-wrap gap-2">
          {project.starting_price && (
            <span className="bg-white/10 border border-white/15 text-white/80 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              From {fmtPrice(project.starting_price)}
            </span>
          )}
          {project.handover_date && (
            <span className="bg-white/10 border border-white/15 text-white/80 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              Handover {fmtHandover(project.handover_date)}
            </span>
          )}
          {firstPlan && (
            <span className="bg-white/10 border border-white/15 text-white/80 text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
              {firstPlan.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-brand-bg min-h-screen">

      {/* Hero */}
      {heroEl}

      {/* ── PUBLIC LAYOUT ── */}
      {!isAuth && (
        <>
          {/* Tab bar */}
          <div className="sticky top-16 z-20 bg-white border-b border-brand-border">
            <div className="max-w-5xl mx-auto px-6 sm:px-10 flex items-center">
              {([
                { key: 'overview', label: 'Overview' },
                { key: 'returns',  label: 'Return Analysis' },
                { key: 'brochure', label: 'Brochure' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setPubTab(key)}
                  className={`py-3.5 mr-6 text-sm font-medium border-b-2 transition-colors ${
                    pubTab === key
                      ? 'border-brand-text text-brand-text'
                      : 'border-transparent text-brand-muted hover:text-brand-text'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Overview tab */}
          {pubTab === 'overview' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10">
              <SecondaryPillNav sections={overviewNavSections} />
              {aboutSection}

              {gallerySection}
              {paymentPlanSection}
              {locationSection}

              {/* Mid-page CTA — between Location and FAQ */}
              <div className="py-10 border-t border-brand-border">
                <div className="bg-brand-surface rounded-2xl px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5" style={{ backgroundColor: '#F4F3F0' }}>
                  <div>
                    <p className="text-sm font-semibold text-brand-text">Want independent analysis on this project?</p>
                    <p className="text-xs text-brand-muted mt-1">Analysis and advice from an independent buyer's agent.</p>
                  </div>
                  <button
                    onClick={() => document.getElementById('lead-gen-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-shrink-0 bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    Get independent advice →
                  </button>
                </div>
              </div>

              {faqSection}
            </div>
          )}

          {/* Return Analysis tab */}
          {pubTab === 'returns' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-20">
              <ReturnAnalysisPanel project={project} isAuth={false} />
            </div>
          )}

          {/* Brochure tab */}
          {pubTab === 'brochure' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10 py-12">
              <div className="max-w-lg">
                <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Download brochure</p>
                <p className="text-sm text-brand-muted mb-6">Verify your email to access floor plans, renders and payment schedule.</p>
                <BrochureForm projectSlug={project.slug} />
              </div>
            </div>
          )}

        </>
      )}

      {/* ── AUTH LAYOUT ── */}
      {isAuth && (
        <>
          {/* Two-tab bar + scroll nav for overview */}
          <div ref={scrollNavRef} className="sticky top-16 z-20 bg-white border-b border-brand-border">
            {/* Tab row */}
            <div className={`max-w-5xl mx-auto px-6 sm:px-10 flex items-center ${authTab === 'overview' ? 'border-b border-brand-border' : ''}`}>
              {([
                { key: 'overview', label: 'Overview' },
                { key: 'returns',  label: 'Return Analysis' },
                { key: 'brochure', label: 'Brochure' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAuthTab(key)}
                  className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-colors ${
                    authTab === key
                      ? 'border-brand-bronze text-brand-bronze'
                      : 'border-transparent text-brand-hint hover:text-brand-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
              {isAdmin && (
                <Link
                  href={`/admin/projects/${project.slug}/edit`}
                  className="ml-auto text-xs text-brand-hint hover:text-brand-bronze transition-colors py-3.5 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit project
                </Link>
              )}
            </div>

          </div>

          {/* Overview tab */}
          {authTab === 'overview' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10">
              <SecondaryPillNav sections={overviewNavSections} />
              {aboutSection}
              {gallerySection}
              {paymentPlanSection}
              {locationSection}
              {developerSection}
              {faqSection}
            </div>
          )}

          {/* Brochure tab */}
          {authTab === 'brochure' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10">
              <BrochureTab slug={project.slug} />
            </div>
          )}

          {/* Return Analysis tab */}
          {authTab === 'returns' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10 space-y-10">
              {myTakeSection}
              <ReturnAnalysisPanel project={project} isAuth={true} />

              {/* Documents */}
              {hasDocs && (
                <section>
                  <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Documents</p>
                  {documents.length > 1 && (
                    <div className="flex gap-1 mb-4 border-b border-brand-border">
                      {documents.map((doc, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveDocTab(i)}
                          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                            activeDocTab === i
                              ? 'border-brand-bronze text-brand-bronze'
                              : 'border-transparent text-brand-hint hover:text-brand-muted'
                          }`}
                        >
                          {doc.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="rounded-xl overflow-hidden border border-brand-border bg-brand-surface">
                    <iframe
                      key={activeDocTab}
                      src={documents[activeDocTab]?.url}
                      title={documents[activeDocTab]?.label}
                      className="w-full"
                      style={{ height: '700px', border: 'none' }}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <a
                      href={documents[activeDocTab]?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-bronze hover:underline flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open in new tab
                    </a>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Lead gen footer ────────────────────────────────────────────────── */}
      <section id="lead-gen-form" className="border-t border-brand-border bg-white">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="max-w-lg">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Independent advice</p>
            <h2 className="text-2xl font-semibold text-brand-text mb-2">Get independent advice on this project</h2>
            <p className="text-sm text-brand-muted mb-8">Analysis and advice from an independent buyer's agent.</p>
            <LeadGenForm
              projectName={project.name}
              onSubmit={(data) => {
                // TODO: wire to submission endpoint (Supabase insert or API route)
                console.log('LeadGenForm submission:', data)
              }}
            />
          </div>
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => i !== null ? (i - 1 + images.length) % images.length : null)}
          onNext={() => setLightboxIndex(i => i !== null ? (i + 1) % images.length : null)}
        />
      )}
    </div>
  )
}
