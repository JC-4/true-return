'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Project, PaymentSegment, ProjectInsight } from '@/lib/types'
import { solveIRR, getYearsToCompletion, parseDateToYear } from '@/lib/calculations'
import type { PlanRow } from '@/lib/calculations'
import DealBuilder from '@/app/(main)/deals/new/DealBuilder'
import type { InitialValues } from '@/lib/hooks/useCalculator'

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
  return plan.segments.map((seg, i) => {
    const isHandover = /hand|deliver|complet/i.test(seg.label)
    const isBooking  = /book|sign|reserv|now/i.test(seg.label)
    const date = isBooking ? 'On booking' : isHandover ? formatHandoverDate(handoverDate) : 'During construction'
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
            href="/api/auth/signin"
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

// ─── Public analysis panel ───────────────────────────────────────────────────

function PublicAnalysisPanel({ project }: { project: Project }) {
  const unitTypes = project.unit_types ?? []
  const scRate = project.service_charge_rate ?? 0
  const planRows = adaptPaymentPlan(project.payment_plans, project.handover_date)
  const completionStr = formatHandoverDate(project.handover_date)

  // ── Unit / bedroom selector ────────────────────────────────────────────────
  const bedroomGroups = [...new Set(unitTypes.map(ut => ut.bedrooms))].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | null>(
    bedroomGroups[0] ?? null
  )
  const unitsInGroup = unitTypes.filter(ut => ut.bedrooms === selectedBedrooms)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(unitsInGroup[0]?.id ?? '')
  const selectedUnit = unitTypes.find(ut => ut.id === selectedUnitId) ?? unitsInGroup[0]

  const basePrice = selectedUnit?.price_from ?? project.starting_price ?? 0
  const internalSqft = selectedUnit?.internal_sqft ?? 0
  const balconySqft = selectedUnit?.balcony_sqft ?? 0

  function snapRent(v: number) { return Math.min(300_000, Math.max(20_000, Math.round(v / 5_000) * 5_000)) }
  function snapHV(v: number)   { return Math.min(5_000_000, Math.max(300_000, Math.round(v / 50_000) * 50_000)) }

  const [rent,          setRent]          = useState(() => snapRent(selectedUnit?.expected_rent          ?? basePrice * 0.07))
  const [handoverValue, setHandoverValue] = useState(() => snapHV  (selectedUnit?.expected_handover_value ?? basePrice * 1.2))
  const [growth,        setGrowth]        = useState(5)
  const [holdPeriod,    setHoldPeriod]    = useState(5)

  // Sync sliders when unit selection changes
  useEffect(() => {
    const unit = unitTypes.find(ut => ut.id === selectedUnitId)
    if (!unit) return
    const p = unit.price_from ?? 0
    setRent(snapRent(unit.expected_rent          ?? p * 0.07))
    setHandoverValue(snapHV(unit.expected_handover_value ?? p * 1.2))
  }, [selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first unit when bedroom group changes
  useEffect(() => {
    const first = unitTypes.find(ut => ut.bedrooms === selectedBedrooms)
    if (first) setSelectedUnitId(first.id)
  }, [selectedBedrooms]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core metrics ──────────────────────────────────────────────────────────
  const serviceCharge = (internalSqft * scRate) + (balconySqft * scRate * 0.25)
  const netIncome     = rent - serviceCharge
  const dldFee        = basePrice * 0.04
  const adminFee      = 4_200
  const firstSlab     = planRows[0]
  const downpayment   = firstSlab ? (firstSlab.pct / 100) * basePrice : 0
  const totalDueNow   = downpayment + dldFee + adminFee

  // ── Payment plan year grouping ─────────────────────────────────────────────
  const rawCompYears  = getYearsToCompletion(completionStr)
  const compYears     = Math.max(0, Math.round(rawCompYears ?? 2))

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

  // ── Scenario computation ──────────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmtA(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`
    if (Math.abs(n) >= 1_000)     return `AED ${Math.round(n / 1_000)}k`
    return `AED ${Math.round(n).toLocaleString()}`
  }
  function fmtP(n: number | null): string {
    if (n === null) return '—'
    return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`
  }
  function bedroomLabel(b: number | null) {
    if (b === null) return 'Commercial'
    if (b === 0)    return 'Studio'
    return `${b} Bed`
  }

  const PILL      = 'px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors border'
  const PILL_ON   = `${PILL} bg-[#18181b] text-white border-[#18181b]`
  const PILL_OFF  = `${PILL} bg-white text-brand-muted border-brand-border hover:border-brand-text hover:text-brand-text`
  const SPILL_ON  = `${PILL} text-[11px] border-brand-bronze text-white`
  const SPILL_OFF = `${PILL} text-[11px] bg-brand-surface border-brand-border text-brand-muted hover:text-brand-text`

  if (unitTypes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-brand-hint">No unit types have been added to this project yet.</p>
      </div>
    )
  }

  return (
    <div className="py-10 space-y-8">

      {/* ── Unit selector ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Select unit</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {bedroomGroups.map(b => (
            <button key={String(b)} onClick={() => setSelectedBedrooms(b)}
              className={selectedBedrooms === b ? PILL_ON : PILL_OFF}>
              {bedroomLabel(b)}
            </button>
          ))}
        </div>
        {unitsInGroup.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {unitsInGroup.map(ut => (
              <button key={ut.id} onClick={() => setSelectedUnitId(ut.id)}
                className={selectedUnitId === ut.id ? SPILL_ON : SPILL_OFF}
                style={selectedUnitId === ut.id ? { backgroundColor: '#A0784A' } : {}}>
                {ut.typology ?? ut.type}
              </button>
            ))}
          </div>
        )}
        {selectedUnit && (
          <p className="text-xs text-brand-hint mt-2">
            {fmtPrice(selectedUnit.price_from)} from
            {selectedUnit.size_sqft_from ? ` · ${selectedUnit.size_sqft_from.toLocaleString()} sqft` : ''}
          </p>
        )}
      </div>

      {/* ── Assumptions ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-brand-border p-5 space-y-6">
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

      {/* ── Payment plan + Acquisition costs (two-col) ─────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-5">

        {/* Payment plan */}
        {yearGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-brand-border p-5">
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

        {/* Acquisition costs */}
        {basePrice > 0 && (
          <div className="bg-white rounded-xl border border-brand-border p-5">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Due at booking</p>
            <div className="space-y-2.5">
              {firstSlab && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">Downpayment ({firstSlab.pct}%)</span>
                  <span className="text-xs font-medium text-brand-text">{fmtA(downpayment)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-muted">DLD fee (4%)</span>
                <span className="text-xs font-medium text-brand-text">{fmtA(dldFee)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-muted">Admin &amp; registration</span>
                <span className="text-xs font-medium text-brand-text">AED 4,200</span>
              </div>
              <div className="border-t border-brand-border pt-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-text">Total due now</span>
                <span className="text-sm font-bold text-brand-text">{fmtA(totalDueNow)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Scenario cards ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Scenarios</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {([
            { label: 'Conservative', metrics: conservative, highlighted: false },
            { label: 'Base',         metrics: base,         highlighted: true  },
            { label: 'Optimistic',   metrics: optimistic,   highlighted: false },
          ] as const).map(({ label, metrics, highlighted }) => (
            <div key={label}
              className={`bg-white rounded-xl border p-5 ${highlighted ? '' : 'border-brand-border'}`}
              style={highlighted ? { borderColor: '#A0784A' } : {}}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-brand-muted">{label}</p>
                {highlighted && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: '#A0784A' }}>
                    Base case
                  </span>
                )}
              </div>
              {metrics.mode === 'hold' ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Net yield</p>
                    <p className="text-lg font-semibold text-brand-text">{fmtP(metrics.netYield)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Value at exit</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtA(metrics.valueAtExit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Total return</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtA(metrics.totalReturn)}</p>
                  </div>
                  {metrics.irr !== null && (
                    <div className="pt-2 border-t border-brand-border">
                      <p className="text-xs text-brand-hint mb-0.5">IRR</p>
                      <p className="text-base font-bold text-brand-text">{fmtP(metrics.irr)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Gain on paper</p>
                    <p className="text-lg font-semibold text-brand-text">{fmtA(metrics.gainOnPaper)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Est. value at handover</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtA(metrics.scenarioHV)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-hint mb-0.5">Return on capital</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtP(metrics.returnOnCapital)}</p>
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

      {/* ── Summary bar ───────────────────────────────────────────────────── */}
      {basePrice > 0 && (
        <div className="rounded-xl px-6 py-4 flex flex-wrap gap-8" style={{ backgroundColor: '#F4F3F0' }}>
          {base.mode === 'hold' ? (
            <>
              <div>
                <p className="text-xs text-brand-hint mb-0.5">Annual net income</p>
                <p className="text-sm font-semibold text-brand-text">{fmtA(netIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-hint mb-0.5">Est. service charge / yr</p>
                <p className="text-sm font-semibold text-brand-text">{scRate > 0 ? fmtA(serviceCharge) : '—'}</p>
              </div>
              {base.irr !== null && (
                <div>
                  <p className="text-xs text-brand-hint mb-0.5">IRR (full hold)</p>
                  <p className="text-sm font-bold text-brand-text">{fmtP(base.irr)}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <p className="text-xs text-brand-hint mb-0.5">Gain on paper</p>
                <p className="text-sm font-semibold text-brand-text">{fmtA(base.gainOnPaper)}</p>
              </div>
              <div>
                <p className="text-xs text-brand-hint mb-0.5">Est. service charge / yr</p>
                <p className="text-sm font-semibold text-brand-text">{scRate > 0 ? fmtA(serviceCharge) : '—'}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Locked CTA ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-brand-border p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ backgroundColor: '#F4F3F0' }}>
          <svg className="w-5 h-5 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-brand-text mb-1">Full breakdown</p>
          <p className="text-xs text-brand-muted leading-relaxed mb-4 max-w-lg">
            The full picture — cashflow, growth scenarios, what you actually walk away with, and independent advice on whether it&apos;s worth your money.
          </p>
          <Link href="/contact"
            className="inline-flex items-center gap-2 text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-colors"
            style={{ backgroundColor: '#A0784A' }}>
            Enquire for access →
          </Link>
        </div>
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
  const [authTab, setAuthTab] = useState<'overview' | 'analysis' | 'brochure'>('overview')

  // Public tab state
  const [pubTab, setPubTab] = useState<'overview' | 'analysis' | 'brochure'>('overview')

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

  // ─── Shared section content ────────────────────────────────────────────────

  const aboutSection = (
    <section id="about" className="py-16">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">About</p>
      {project.description ? (
        <p className="text-sm text-brand-muted leading-relaxed max-w-3xl">{project.description}</p>
      ) : (
        <p className="text-sm text-brand-hint">No description available.</p>
      )}
    </section>
  )

  const unitsSection = unitTypes.length > 0 ? (
    <section id="units" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Units</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {unitTypes.map(ut => (
          <div key={ut.id} className="bg-white border border-brand-border rounded-xl p-5">
            <p className="text-sm font-medium text-brand-text">{ut.type}</p>
            <p className="text-xl font-medium text-brand-bronze mt-1">{fmtPrice(ut.price_from)}</p>
            <div className="border-t border-brand-border my-3" />
            <p className="text-xs text-brand-hint">{ut.size_sqft_from.toLocaleString()} sqft</p>
            <p className="text-xs text-brand-hint mt-0.5">AED {ut.price_per_sqft.toLocaleString()}/sqft</p>
          </div>
        ))}
      </div>
    </section>
  ) : null

  const gallerySection = (
    <section id="gallery" className="py-16 border-t border-brand-border">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Gallery</p>
      {images.length > 0 ? (
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px]">
          <div className="col-span-2 row-span-2 rounded-xl overflow-hidden bg-brand-surface">
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl overflow-hidden bg-brand-surface flex items-center justify-center">
              {images[i] ? (
                <img src={images[i]} alt="" className="w-full h-full object-cover" />
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
    <div className="relative min-h-[420px] bg-brand-text overflow-hidden flex flex-col justify-end" style={{ backgroundColor: '#1C1B18' }}>
      {hero && (
        <img src={hero} alt={project.name} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Top badges */}
      <div className="absolute top-6 left-6 sm:left-10 right-6 sm:right-10 flex items-start justify-between gap-2">
        {project.status ? (
          <span className="bg-brand-bronze text-white text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: '#A0784A' }}>
            {statusLabel(project.status)}
          </span>
        ) : <span />}
        {project.handover_date && (
          <span className="bg-white/10 border border-white/20 text-white/75 text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Handover {fmtHandover(project.handover_date)}
          </span>
        )}
      </div>

      {/* Title block */}
      <div className="relative px-6 sm:px-10 pb-6 max-w-5xl mx-auto w-full">
        <p className="text-brand-bronze-mid text-xs tracking-widest uppercase mb-2">{project.developer?.name}</p>
        <h1 className="text-4xl sm:text-5xl font-medium text-white leading-tight mb-3">{project.name}</h1>
        {project.location && (
          <p className="text-sm text-white/50 mb-5">{project.location}{project.community ? ` · ${project.community}` : ''}</p>
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
              {(['overview', 'analysis', 'brochure'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPubTab(tab)}
                  className={`py-3.5 mr-6 text-sm font-medium border-b-2 transition-colors capitalize ${
                    pubTab === tab
                      ? 'border-brand-text text-brand-text'
                      : 'border-transparent text-brand-muted hover:text-brand-text'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Overview tab */}
          {pubTab === 'overview' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10">
              {aboutSection}
              {unitsSection}

              {/* Mid-page CTA — after Units */}
              <div className="py-10 border-t border-brand-border">
                <div className="bg-brand-surface rounded-2xl px-6 py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5" style={{ backgroundColor: '#F4F3F0' }}>
                  <div>
                    <p className="text-sm font-semibold text-brand-text">Want independent analysis on this project?</p>
                    <p className="text-xs text-brand-muted mt-1">Buyer-side guidance only. No developer fees, no pressure.</p>
                  </div>
                  <Link
                    href="/contact"
                    className="flex-shrink-0 bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    Get independent advice →
                  </Link>
                </div>
              </div>

              {gallerySection}
              {paymentPlanSection}
              {locationSection}
              {faqSection}
            </div>
          )}

          {/* Analysis tab */}
          {pubTab === 'analysis' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-20">
              <PublicAnalysisPanel project={project} />
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

          {/* Sticky CTA — hidden on analysis tab */}
          {pubTab !== 'analysis' && (
            <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
              <div className="max-w-5xl mx-auto px-6 sm:px-10 pb-6 flex justify-center">
                <Link
                  href="/contact"
                  className="pointer-events-auto inline-flex items-center gap-2 bg-brand-text text-white text-sm font-medium px-6 py-3 rounded-full shadow-xl hover:bg-brand-text/90 transition-colors"
                  style={{ backgroundColor: '#1C1B18' }}
                >
                  <svg className="w-4 h-4 text-brand-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#A0784A' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Get independent advice
                </Link>
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
              {(['overview', 'analysis', 'brochure'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAuthTab(tab)}
                  className={`px-5 py-3.5 text-xs font-semibold capitalize border-b-2 transition-colors ${
                    authTab === tab
                      ? 'border-brand-bronze text-brand-bronze'
                      : 'border-transparent text-brand-hint hover:text-brand-muted'
                  }`}
                >
                  {tab === 'overview' ? 'Overview' : tab === 'analysis' ? 'Analysis' : 'Brochure'}
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
              {aboutSection}
              {unitsSection}
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

          {/* Analysis tab */}
          {authTab === 'analysis' && (
            <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-10">
              {myTakeSection}
              <div className="rounded-2xl overflow-clip ring-1 ring-brand-border -mx-6 sm:-mx-10">
                <DealBuilder
                  initialValues={calcInitialValues}
                  lockDeveloper
                  lockProject
                  compact
                  stickyTop="top-28"
                  showShare={isAdmin}
                  showSaveDefault={isAdmin}
                  showLoad={isAdmin}
                />
              </div>

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

    </div>
  )
}
