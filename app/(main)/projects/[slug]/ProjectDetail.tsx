'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Project, PaymentSegment, ProjectInsight } from '@/lib/types'
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

// ─── Section nav ─────────────────────────────────────────────────────────────

// All possible section IDs — used for observer registration (missing refs are safely skipped)
const ALL_SECTION_IDS = ['overview', 'gallery', 'my-take', 'calculator', 'payment-plan', 'location', 'amenities', 'documents', 'faq'] as const

const SECTION_LABELS: Record<string, string> = {
  overview:       'Overview',
  gallery:        'Gallery',
  'payment-plan': 'Payment plan',
  location:       'Location',
  amenities:      'Amenities',
  faq:            'FAQ',
  'my-take':      'My Take',
  calculator:     'Calculator',
  documents:      'Documents',
}

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

// ─── Main component ───────────────────────────────────────────────────────────

type SnapshotValues = InitialValues & { bedrooms?: number | null; typology?: string | null }

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
  const [activeSection, setActiveSection] = useState('overview')
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  // Insight-derived flags
  const hasMytake = !!(insight?.insight_opinion || insight?.insight_projections || insight?.insight_risks)
  const documents = insight?.documents ?? []
  const hasDocs   = documents.length > 0
  const [activeDocTab, setActiveDocTab] = useState(0)

  // Dynamic nav order: insight sections slot in after gallery / before faq
  const SECTIONS: string[] = [
    'overview', 'gallery',
    ...(hasMytake ? ['my-take'] : []),
    ...(insight   ? ['calculator'] : []),
    'payment-plan', 'location', 'amenities',
    ...(hasDocs   ? ['documents'] : []),
    'faq',
  ]

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

  // Calculator initial values derived from project data, optionally overridden by a snapshot
  const calcInitialValues: (InitialValues & { bedrooms?: number | null; typology?: string | null }) | undefined = insight ? {
    price:       project.starting_price ?? 0,
    completion:  formatHandoverDate(project.handover_date),
    developer:   project.developer?.name ?? '',
    developerId: project.developer_id,
    projectSlug: project.slug,
    project:     project.name,
    propertyType: 'offplan',
    paymentPlan: adaptPaymentPlan(project.payment_plans, project.handover_date),
    // Saved defaults override project values (if admin has set them)
    ...(insight.defaultParams ? applyDefaultParams(insight.defaultParams) : {}),
    // Snapshot values override everything (shareable link)
    ...snapshotValues,
  } : undefined

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    ALL_SECTION_IDS.forEach(id => {
      const el = sectionRefs.current[id]
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { rootMargin: '-30% 0px -60% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hero = project.images?.[0] ?? null
  const images = project.images ?? []
  const plans = project.payment_plans ?? []
  const connectivity = project.connectivity ?? []
  const amenities = project.amenities ?? []
  const faqs = project.faqs ?? []
  const unitTypes = project.unit_types ?? []
  const firstPlan = plans[0]

  return (
    <div className="bg-brand-bg min-h-screen">

      {/* 1. Hero */}
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
        <div className="relative px-6 sm:px-10 pb-10 max-w-5xl mx-auto w-full">
          <p className="text-brand-bronze-mid text-xs tracking-widest uppercase mb-2">{project.developer?.name}</p>
          <h1 className="text-5xl font-medium text-white leading-tight mb-2">{project.name}</h1>
          {project.location && (
            <p className="text-sm text-white/50">{project.location}{project.community ? ` · ${project.community}` : ''}</p>
          )}
        </div>
      </div>

      {/* 2. Check availability card */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 pt-6">
        <div className="bg-white border border-brand-border rounded-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-hint mb-0.5">Starting from</p>
              <p className="text-sm font-medium text-brand-text">{fmtPrice(project.starting_price)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-hint mb-0.5">Handover</p>
              <p className="text-sm font-medium text-brand-text">{fmtHandover(project.handover_date)}</p>
            </div>
            {firstPlan && (
              <div>
                <p className="text-xs uppercase tracking-widest text-brand-hint mb-0.5">Payment plan</p>
                <p className="text-sm font-medium text-brand-text">{firstPlan.name}</p>
              </div>
            )}
          </div>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            style={{ backgroundColor: '#A0784A' }}
          >
            Check availability →
          </a>
        </div>
      </div>

      {/* 3. Sticky section nav */}
      <div className="sticky top-16 z-20 bg-white border-b border-brand-border mt-6">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 flex overflow-x-auto">
          {SECTIONS.map(id => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex-shrink-0 px-4 py-3.5 text-xs font-medium border-b-2 transition-colors ${
                activeSection === id
                  ? 'border-brand-bronze text-brand-bronze'
                  : 'border-transparent text-brand-hint hover:text-brand-muted'
              }`}
            >
              {SECTION_LABELS[id]}
            </button>
          ))}
        </div>
      </div>

      {/* Content sections */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10">

        {/* 4. Overview */}
        <section id="overview" ref={el => { sectionRefs.current['overview'] = el }} className="py-16">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Overview</p>
          {project.description ? (
            <p className="text-sm text-brand-muted leading-relaxed max-w-3xl">{project.description}</p>
          ) : (
            <p className="text-sm text-brand-hint">No description available.</p>
          )}
        </section>

        {/* 5. Gallery */}
        <section id="gallery" ref={el => { sectionRefs.current['gallery'] = el }} className="py-16 border-t border-brand-border">
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

        {/* My Take — independent analysis overlay */}
        {hasMytake && (
          <section id="my-take" ref={el => { sectionRefs.current['my-take'] = el }} className="py-16 border-t border-brand-border">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#1C1B18' }}>
              {/* Header */}
              <div className="px-8 py-5 border-b border-white/10 flex items-center gap-2.5">
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#A0784A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#A0784A' }}>Independent Analysis</span>
              </div>
              {/* Three columns */}
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
        )}

        {/* 6. Unit mix */}
        {unitTypes.length > 0 && (
          <section className="py-16 border-t border-brand-border">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Unit mix</p>
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
        )}

        {/* 7. Payment plan */}
        {plans.length > 0 && (
          <section id="payment-plan" ref={el => { sectionRefs.current['payment-plan'] = el }} className="py-16 border-t border-brand-border">
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
        )}

        {/* Calculator — embedded, pre-filled */}
        {insight && (
          <section id="calculator" ref={el => { sectionRefs.current['calculator'] = el }} className="py-16 border-t border-brand-border">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-6">Run the numbers</p>
            <div className="rounded-2xl overflow-clip ring-1 ring-brand-border -mx-6 sm:-mx-10">
              <DealBuilder
                initialValues={calcInitialValues}
                lockDeveloper lockProject
                stickyTop="top-28"
                showShare={isAdmin}
                showSaveDefault={isAdmin}
                showLoad={isAdmin}
              />
            </div>
          </section>
        )}

        {/* 8. Connectivity */}
        {connectivity.length > 0 && (
          <section id="location" ref={el => { sectionRefs.current['location'] = el }} className="py-16 border-t border-brand-border">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Connectivity</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {connectivity.map((item, i) => (
                <div key={i} className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC' }}>
                  <ConnectivityIcon label={item.label} />
                  <span className="text-sm text-brand-muted truncate">{item.label}</span>
                  <span className="ml-auto text-xs font-medium text-brand-bronze flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Amenities */}
        {amenities.length > 0 && (
          <section id="amenities" ref={el => { sectionRefs.current['amenities'] = el }} className="py-16 border-t border-brand-border">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {amenities.map((a, i) => (
                <span key={i} className="bg-brand-surface border border-brand-border rounded-full px-3 py-1 text-xs text-brand-muted" style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC' }}>
                  {a}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 10. Documents (insight page) or brochure gate (public page) */}
        {insight ? (
          hasDocs && (
            <section id="documents" ref={el => { sectionRefs.current['documents'] = el }} className="py-16 border-t border-brand-border">
              <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Documents</p>
              {/* Tab bar */}
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
              {/* PDF viewer */}
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
          )
        ) : (
          <section className="py-16 border-t border-brand-border">
            <div className="bg-brand-bronze-light border border-[#DCC4A8] rounded-xl px-6 py-5 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between" style={{ backgroundColor: '#F2EAE0', borderColor: '#DCC4A8' }}>
              <div>
                <p className="text-sm font-medium text-brand-text">Download the full brochure</p>
                <p className="text-xs text-brand-muted mt-1">Verify your email to access floor plans, renders and payment schedule.</p>
              </div>
              <div className="flex-shrink-0 w-full sm:w-auto">
                <BrochureForm projectSlug={project.slug} />
              </div>
            </div>
          </section>
        )}

        {/* 11. Developer card */}
        {project.developer && (
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
        )}

        {/* 12. FAQ */}
        {faqs.length > 0 && (
          <section id="faq" ref={el => { sectionRefs.current['faq'] = el }} className="py-16 border-t border-brand-border">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">FAQ</p>
            <FaqAccordion faqs={faqs} />
          </section>
        )}

      </div>

      {/* 13. Bottom CTA */}
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16">
        <div className="bg-brand-text rounded-2xl px-8 sm:px-12 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8" style={{ backgroundColor: '#1C1B18' }}>
          <div>
            <h2 className="text-lg font-medium text-white">Get independent advice on this project</h2>
            <p className="text-sm text-white/40 mt-2 leading-relaxed max-w-md">
              Buyer-side guidance only. No developer fees, no pressure. Just an honest view on whether this is right for you.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-white/15 text-white/65 text-sm px-4 py-2.5 rounded-lg hover:bg-white/5 flex items-center gap-2 transition-colors justify-center"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.528 5.855L.057 23.882l6.194-1.624A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.954a9.928 9.928 0 01-5.049-1.375l-.361-.215-3.741.981.998-3.648-.235-.374A9.956 9.956 0 012.046 12C2.046 6.476 6.476 2.046 12 2.046S21.954 6.476 21.954 12 17.524 21.954 12 21.954z"/>
              </svg>
              WhatsApp
            </a>
            <Link
              href="/contact"
              className="bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors text-center"
              style={{ backgroundColor: '#A0784A' }}
            >
              Get in touch
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
