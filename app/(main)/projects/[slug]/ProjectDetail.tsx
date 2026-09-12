'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import type { Project, PaymentSegment, ProjectInsight } from '@/lib/types'
import type { PlanRow } from '@/lib/calculations'
import type { InitialValues } from '@/lib/hooks/useCalculator'
import LeadGenForm from '@/components/LeadGenForm'
import ReturnAnalysisPanel from '@/components/ReturnAnalysisPanel'
import GallerySlider, { Lightbox } from '@/components/GallerySlider'
import BrochureTab from '@/components/BrochureTab'
import AdminEditLink from '@/components/AdminEditLink'
import { SecondaryPillNav } from '@/components/SharedUI'
import { adaptPaymentPlan, formatHandoverDate, classifyPlanSeg, paymentPlanSummary } from '@/lib/payment-plan'
import { pickShowcaseUnit } from '@/lib/units'
import { fmtLocation } from '@/lib/format'
import { whatsappHref } from '@/lib/whatsapp'

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

// ── Payment plan colour scale (by segment type, not slab colour) ──────────────

const PLAN_COLORS = {
  downpayment:   '#3D2008',
  construction:  '#8B5E2A',
  handover:      '#C9A96E',
  'post-handover': '#E8D5B0',
} as const

type PlanSegType = keyof typeof PLAN_COLORS

/** `label`/`value` feed the About block's cards; `line` is the same fact
 *  written as prose for the hero's single summary line. */
type ProjectStat = { key: string; label: string; value: string; line: string }

const PLAN_SEG_LABELS: Record<PlanSegType, string> = {
  downpayment:   'Downpayment',
  construction:  'During construction',
  handover:      'Handover',
  'post-handover': 'Post-handover',
}

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

/** Secondary route beside the brochure submit button, matching the lead form.
 *  Renders nothing when NEXT_PUBLIC_WHATSAPP_NUMBER is unset. */
function BrochureWhatsappLink({ projectName, label = 'or WhatsApp' }: { projectName: string; label?: string }) {
  const href = whatsappHref(`Hi, I'd like the brochure for ${projectName}.`)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center justify-center min-h-[48px] whitespace-nowrap text-sm font-medium text-brand-muted hover:text-brand-text underline underline-offset-4 decoration-brand-border hover:decoration-brand-text transition-colors"
    >
      {label}
    </a>
  )
}

function BrochureForm({ projectSlug, projectName }: { projectSlug: string; projectName: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = 'border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text bg-white focus:outline-none focus:ring-1 focus:ring-brand-bronze focus:border-brand-bronze placeholder:text-brand-hint'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, project_slug: projectSlug, source: 'Brochure' }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setSubmitted(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm font-semibold text-brand-text">Thanks, we&apos;ll send the brochure over shortly.</p>
        <BrochureWhatsappLink projectName={projectName} label="Message us on WhatsApp" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row flex-wrap gap-2">
      <input value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" className={`${inputCls} w-full sm:w-36`} />
      <input
        value={phone}
        inputMode="tel"
        required
        onChange={e => {
          const raw = e.target.value
          setPhone((raw.startsWith('+') ? '+' : '') + raw.replace(/[^\d\s]/g, '').replace(/^\s+/, ''))
        }}
        placeholder="Phone number"
        className={`${inputCls} w-full sm:w-36`}
      />
      <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" className={`${inputCls} w-full sm:w-44`} />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading || !name.trim() || !phone.trim()}
          className="min-h-[48px] bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
          style={{ backgroundColor: '#A0784A' }}
        >
          {loading ? 'Sending…' : 'Get brochure'}
        </button>
        <BrochureWhatsappLink projectName={projectName} />
      </div>
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

// ─── Floor plan lightbox ──────────────────────────────────────────────────────

function FloorPlanLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-2xl leading-none"
        aria-label="Close"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Floor plan"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProjectDetail({
  project,
  insight: insightProp,
  snapshotValues,
}: {
  project: Project
  /** Supplied by the token-gated share route, which renders on the server and
   *  already knows the visitor is entitled to see it. The project page leaves
   *  this undefined and lets the fetch below resolve it. */
  insight?: ProjectInsight
  snapshotValues?: SnapshotValues
}) {
  // The project page is statically rendered, so the private layer cannot come
  // from the server — reading the session there would opt the route out of the
  // route cache. It is fetched here once the session resolves, the same way
  // AdminEditLink resolves the admin affordance.
  const { status } = useSession()
  const [fetchedInsight, setFetchedInsight] = useState<ProjectInsight | null>(null)

  // Every dependency here is a primitive. `session.user` is a fresh object on
  // each provider render, so depending on it re-ran this effect after its own
  // setState and hammered the endpoint in a loop. `status` says all it needs
  // to: 'authenticated' already implies a user.
  const hasInsightProp = !!insightProp
  useEffect(() => {
    // Nothing to do when the parent already supplied one (share route), or
    // while the session is still loading, or for an anonymous visitor.
    if (hasInsightProp || status !== 'authenticated') return
    let cancelled = false
    fetch(`/api/projects/${project.slug}/insight`)
      .then(res => (res.ok ? res.json() as Promise<ProjectInsight> : null))
      .then(data => { if (!cancelled && data) setFetchedInsight(data) })
      .catch(() => { /* stay on the public view rather than half-render */ })
    return () => { cancelled = true }
  }, [hasInsightProp, status, project.slug])

  // `{}` is truthy and that is load-bearing: the endpoint returns an empty
  // object for a project with no analysis written yet, which still signals
  // "authenticated" so the calculator renders. Until it resolves this is
  // undefined and the public layout renders — no skeleton, nothing that would
  // make the page look incomplete to the anonymous visitors it is cached for.
  const insight = insightProp ?? fetchedInsight ?? undefined
  const isAuth = !!insight

  // Auth tab state
  const [authTab, setAuthTab] = useState<'overview' | 'returns' | 'brochure'>('overview')

  // Public tab state
  const [pubTab, setPubTab] = useState<'overview' | 'returns' | 'brochure'>('overview')

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null)
  const [activePlanIndex, setActivePlanIndex] = useState(0)

  const scrollNavRef = useRef<HTMLDivElement | null>(null)
  const pubTabRef = useRef<HTMLDivElement | null>(null)

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
  const unitTypes = [...(project.unit_types ?? [])].sort((a, b) => {
    if (a.bedrooms === null && b.bedrooms === null) return 0
    if (a.bedrooms === null) return 1
    if (b.bedrooms === null) return -1
    if (a.bedrooms !== b.bedrooms) return a.bedrooms - b.bedrooms
    return (a.size_sqft_from ?? 0) - (b.size_sqft_from ?? 0)
  })
  // Selection for the units + payment plan section. Local to this section —
  // ReturnAnalysisPanel keeps its own selector and its own default.
  const [selectedUnitId, setSelectedUnitId] = useState<string>(() => pickShowcaseUnit(unitTypes)?.id ?? '')
  const unitScrollRef = useRef<HTMLDivElement | null>(null)
  const selectedUnit = unitTypes.find(ut => ut.id === selectedUnitId) ?? pickShowcaseUnit(unitTypes)
  const selectedUnitPrice = selectedUnit?.price_from ?? project.starting_price ?? 0

  // On mobile the cards are a scroll row; bring the default into view if it
  // isn't the first card. No-op on desktop, where the row is a grid.
  useEffect(() => {
    const el = unitScrollRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-unit-selected="true"]')
    if (!card) return
    // Measure against the scroll container, not offsetParent, which sits
    // outside the row and would add the page padding to the offset.
    const delta = card.getBoundingClientRect().left - el.getBoundingClientRect().left
    if (delta > 0) el.scrollLeft = delta - 16
  }, [])

  const planSummary = paymentPlanSummary(plans)
  const firstPlanLabel = planSummary ? `${planSummary} payment plan` : null

  /** The three headline figures, derived once. The hero and the About block
   *  both show them, in a different order, so neither recomputes them. */
  const statFrom: ProjectStat | null = project.starting_price
    ? { key: 'from', label: 'From', value: fmtPrice(project.starting_price), line: `From ${fmtPrice(project.starting_price)}` }
    : null
  const statHandover: ProjectStat | null = fmtHandover(project.handover_date) !== '—'
    ? { key: 'handover', label: 'Handover', value: fmtHandover(project.handover_date), line: `${fmtHandover(project.handover_date)} handover` }
    : null
  const statPlan: ProjectStat | null = firstPlanLabel
    ? { key: 'plan', label: 'Payment plan', value: firstPlanLabel.replace(' payment plan', ''), line: firstPlanLabel }
    : null
  const isStat = (s: ProjectStat | null): s is ProjectStat => s !== null
  const heroStats  = [statFrom, statHandover, statPlan].filter(isStat)
  const aboutStats = [statHandover, statFrom, statPlan].filter(isStat)

  const mapEmbedSrc = (() => {
    const html = project.map_embed_html
    if (!html) return null
    const match = html.match(/src="([^"]+)"/)
    return match ? match[1] : null
  })()

  const overviewNavSections = [
    { id: 'about', label: 'About' },
    { id: 'units', label: 'Unit Types' },
    ...(plans.length > 0 ? [{ id: 'payment-plan', label: 'Payment plan' }] : []),
    ...(images.length > 1 ? [{ id: 'gallery', label: 'Gallery' }] : []),
    ...((connectivity.length > 0 || mapEmbedSrc) ? [{ id: 'location', label: 'Location' }] : []),
  ]

  // ─── Shared section content ────────────────────────────────────────────────

  const aboutSection = (
    <section id="about" className="py-16">
      <div className="grid md:grid-cols-2 gap-8 items-stretch">

        {/* Left: image with stats overlay */}
        <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: '#1C1B18', height: '100%', minHeight: '480px' }}>
          {(project.about_image_url ?? images[0]) && (
            <img
              src={project.about_image_url ?? images[0]}
              alt={project.name}
              className="w-full h-full object-cover"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: project.about_image_position ?? 'center',
                opacity: 0.85,
              }}
            />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(28,27,24,0.85) 0%, rgba(28,27,24,0.05) 55%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20 }}>
            <div className="grid grid-cols-3 gap-2">
              {aboutStats.map(stat => (
                <div key={stat.key} className="rounded-xl px-3 py-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-poppins, Poppins, sans-serif)', lineHeight: 1.2 }}>{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: description + developer */}
        <div className="flex flex-col justify-center py-2">
          {/* Grouping wrapper. Inert under justify-center, which packs the
              children together and centres them as one block — but it is what
              keeps the tagline and highlights from being spread apart if this
              column ever goes back to justify-between. */}
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">About this project</p>
            {project.tagline && (
              <h2 className="text-xl font-semibold text-brand-text leading-snug mb-4">{project.tagline}</h2>
            )}
            {project.highlights && project.highlights.length > 0 && (
              <div className="flex flex-col gap-2.5 mb-6">
                {project.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div
                      className="flex-shrink-0 mt-0.5"
                      style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: '#F4F3F0', border: '0.5px solid #E5E3DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#A0784A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm text-brand-muted leading-relaxed">{h}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {project.developer && (
            <div className="pt-5 border-t border-brand-border">
              <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Developer</p>
              <div className="flex items-center gap-3">
                {/* Split by branch: this block sits on the cream page background,
                    not inside a card, so a real logo gets no background at all and
                    the transparent PNG sits directly on the page. The initial
                    fallback keeps its dark chip. */}
                {project.developer.logo_url ? (
                  <div className="w-24 h-12 flex-shrink-0 flex items-center justify-center">
                    <img
                      src={project.developer.logo_url}
                      alt={project.developer.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#1C1B18' }}>
                    <span className="text-white text-xs font-semibold">{project.developer.name.charAt(0)}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-brand-text">{project.developer.name}</p>
                  <Link href={`/developers/${project.developer.slug}`} className="text-xs text-brand-bronze hover:underline">
                    View all projects →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )

  // Units and payment plan are one interactive section: selecting a unit
  // recalculates the plan below it.
  const unitsAndPlanSection = (unitTypes.length > 0 || plans.length > 0) ? (
    <section id="units" className="py-16 border-t border-brand-border">
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-2">Unit types</p>
          <h2 className="text-2xl font-semibold text-brand-text">Choose your unit</h2>
        </div>
        <span className="text-xs text-brand-hint">Prices from, indicative</span>
      </div>

      {unitTypes.length > 0 && (
        // Scroll row on mobile with a partial card showing at the edge; grid
        // from md up. pt-4 keeps the featured badge clear of the scroll clip.
        <div
          ref={unitScrollRef}
          className="unit-scroll flex gap-3 mb-4 pt-4 overflow-x-auto"
          // Column count comes from the data: projects carry anywhere from
          // three to six unit types and they all sit on one desktop row.
          style={{ scrollbarWidth: 'none', ['--unit-cols' as string]: unitTypes.length }}
        >
          {unitTypes.map(ut => {
            const isSelected = ut.id === selectedUnitId
            const isFeatured = !!ut.is_featured
            const featuredLabel = ut.featured_label || 'Most popular'
            return (
              <div
                key={ut.id}
                data-unit-selected={isSelected ? 'true' : 'false'}
                onClick={() => setSelectedUnitId(ut.id)}
                className="relative border rounded-xl p-4 w-44 flex-shrink-0 md:w-auto transition-colors"
                style={{
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#1C1B18' : '#ffffff',
                  borderColor: isSelected ? '#C9A96E' : '#E5E3DC',
                  borderWidth: isSelected ? 2 : 1,
                }}
              >
                {/* Badge marks the featured unit whether or not it's selected */}
                {isFeatured && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-white text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    {featuredLabel}
                  </div>
                )}
                <p
                  className="text-xs uppercase tracking-widest font-medium mb-2"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : '#9B9589' }}
                >
                  {ut.type}
                </p>
                <p
                  className="text-xl font-semibold mb-1"
                  style={{ color: isSelected ? '#C9A96E' : '#A0784A' }}
                >
                  {fmtPrice(ut.price_from)}
                </p>
                <p
                  className="text-xs"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.4)' : '#9B9589' }}
                >
                  from {ut.size_sqft_from.toLocaleString()} sqft
                </p>
                {/* Fixed height so cards without a floor plan match the others */}
                <div className="mt-3 h-4 flex items-center">
                  {ut.floor_plan_url && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setFloorPlanUrl(ut.floor_plan_url!) }}
                      className="text-[11px] underline underline-offset-2 transition-opacity hover:opacity-70"
                      style={{
                        color: isSelected ? 'rgba(255,255,255,0.55)' : '#9B9589',
                        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                      }}
                    >
                      View floor plan
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Payment plan, recalculated from the selected unit ─────────────── */}
      {plans.length > 0 && (() => {
        const plan = plans[activePlanIndex] ?? plans[0]
        const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`

        return (
          <div id="payment-plan" className="mt-14">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-6">Payment plan</p>

            {/* Plan selector — only shown when multiple plans exist */}
            {plans.length > 1 && (
              <div style={{ display: 'inline-flex', background: '#F4F3F0', borderRadius: 9999, padding: 4, marginBottom: 16, gap: 0 }}>
                {plans.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePlanIndex(i)}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '6px 16px',
                      borderRadius: 9999,
                      border: 'none',
                      cursor: 'pointer',
                      background: activePlanIndex === i ? '#1C1B18' : 'transparent',
                      color: activePlanIndex === i ? '#fff' : '#9B9589',
                      transition: 'background 0.2s, color 0.2s',
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ background: '#F4F3F0', borderRadius: 16, overflow: 'hidden', marginBottom: 10 }}>
              {/* One row per actual segment — the merged view hid the
                  instalment schedule, and the bar makes the shape readable. */}
              <div>
                {plan.segments.map((seg, i) => {
                  const type = classifyPlanSeg(seg.label)
                  const isHandover = type === 'handover'
                  // Labels that just restate the percentage add nothing beside it
                  const label = /^\s*\d+(\.\d+)?\s*%\s*$/.test(seg.label ?? '') ? '' : seg.label?.trim()
                  const middle = [label, seg.date?.trim()].filter(Boolean).join(' · ') || PLAN_SEG_LABELS[type]
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 sm:gap-5 px-4 sm:px-7 py-4"
                      style={{
                        borderTop: i > 0 ? '0.5px solid #E5E3DC' : undefined,
                        background: isHandover ? 'rgba(160,120,74,0.10)' : undefined,
                      }}
                    >
                      <div className="w-[92px] sm:w-[116px] flex-shrink-0">
                        <p style={{ fontSize: 18, fontWeight: 600, color: '#A0784A', margin: '0 0 6px', lineHeight: 1 }}>
                          {seg.percent}%
                        </p>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(28,27,24,0.08)', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.max(0, Math.min(100, seg.percent))}%`,
                            height: '100%',
                            borderRadius: 2,
                            background: PLAN_COLORS[type] ?? '#C9A96E',
                          }} />
                        </div>
                      </div>
                      <p style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#5C5852', margin: 0 }}>{middle}</p>
                      {selectedUnitPrice > 0 && (
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#1C1B18', margin: 0, whiteSpace: 'nowrap' }}>
                          {aed(selectedUnitPrice * seg.percent / 100)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-xs text-brand-hint mt-3 leading-relaxed">
              {selectedUnit
                ? `Indicative figures, based on the entry price for the ${selectedUnit.type}.${unitTypes.length > 1 ? ' Select another unit type above to update them.' : ''}`
                : 'Indicative figures, based on the entry price.'}
            </p>
          </div>
        )
      })()}

      {/* The section's single CTA */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl px-5 py-4 mt-6"
        style={{ backgroundColor: '#A0784A' }}
      >
        <p className="text-sm" style={{ color: '#ffffff' }}>Not sure which unit is right for your budget and goals?</p>
        <button
          onClick={() => document.getElementById('lead-gen-form')?.scrollIntoView({ behavior: 'smooth' })}
          className="flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90 whitespace-nowrap"
          style={{ border: '0.5px solid rgba(255,255,255,0.5)', color: '#ffffff', backgroundColor: 'transparent' }}
        >
          Get unit recommendation →
        </button>
      </div>
    </section>
  ) : null

  const gallerySection = images.length > 1 ? (
    <GallerySlider images={images.slice(1)} onOpenLightbox={(i) => setLightboxIndex(i + 1)} />
  ) : null

  const locationSection = (connectivity.length > 0 || mapEmbedSrc) ? (
    <section id="location" className="py-16 border-t border-brand-border">
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Location</p>
        {mapEmbedSrc && (
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: connectivity.length > 0 ? 24 : 0 }}>
            <iframe
              src={mapEmbedSrc}
              width="100%"
              height="380"
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
        {connectivity.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {connectivity.map((item, i) => (
              <div key={i} className="bg-brand-surface border border-brand-border rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC' }}>
                <ConnectivityIcon label={item.label} />
                <span className="text-sm text-brand-muted truncate">{item.label}</span>
                <span className="ml-auto text-xs font-medium text-brand-bronze flex-shrink-0">{item.time}</span>
              </div>
            ))}
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

  const amenitiesSection = amenities.length > 0 ? (
    <section id="amenities" className="py-16 border-t border-brand-border">
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Amenities</p>
        <div className="flex flex-wrap gap-2">
          {amenities.map((a, i) => (
            <span
              key={i}
              className="text-sm px-4 py-2 rounded-full border"
              style={{ backgroundColor: '#ffffff', borderColor: '#E5E3DC', color: '#5C5852' }}
            >
              {a}
            </span>
          ))}
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
    <div
      className="relative overflow-hidden flex flex-col justify-end w-full min-h-[400px] md:min-h-0 md:aspect-[16/9] md:max-h-[600px]"
      style={{ backgroundColor: '#1C1B18' }}
    >
      {/* One treatment at every width: a full-bleed backdrop with the identity
          block over it. A min-height on mobile buys the block room to sit on
          the image rather than under it. */}
      {hero && (
        <img src={hero} alt={project.name} className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

      {/* Status badge */}
      {project.status && (
        <div className="absolute top-4 left-6 sm:top-6 sm:left-10">
          <span className="bg-brand-bronze text-white text-xs font-medium px-3 py-1 rounded-full" style={{ backgroundColor: '#A0784A' }}>
            {statusLabel(project.status)}
          </span>
        </div>
      )}

      {/* Identity, the numbers as one line, and the single primary CTA */}
      <div className="relative px-6 sm:px-10 pt-6 pb-6 max-w-6xl mx-auto w-full">
        {project.developer?.name && (
          <p className="text-brand-bronze-mid text-[11px] sm:text-xs tracking-widest uppercase mb-1.5">{project.developer.name}</p>
        )}
        <h1 className="text-2xl sm:text-3xl md:text-5xl font-medium text-white leading-tight mb-2">{project.name}</h1>
        <p className="text-xs sm:text-sm text-white/50">
          {fmtLocation(project)}
        </p>

        {heroStats.length > 0 && (
          <p className="mt-2 text-sm sm:text-base text-white/85 font-medium">
            {heroStats.map(stat => stat.line).join(' · ')}
          </p>
        )}

        <button
          onClick={() => document.getElementById('lead-gen-form')?.scrollIntoView({ behavior: 'smooth' })}
          className="mt-5 w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-6 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#A0784A' }}
        >
          Get my analysis
        </button>
      </div>
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-brand-bg min-h-screen">

      {/* Scoped to this page: the site nav (64px) and the tab bar (52px) are
          both sticky, so anchors would otherwise land under them. */}
      <style>{`
        html { scroll-padding-top: 116px; }
        .unit-scroll::-webkit-scrollbar { display: none; }
        @media (min-width: 768px) {
          .unit-scroll {
            display: grid;
            /* One row; the floor keeps six-across readable and lets the row
               scroll rather than crushing cards on a narrow desktop. */
            grid-template-columns: repeat(var(--unit-cols), minmax(140px, 1fr));
          }
          .unit-scroll > * { width: auto; }
        }
      `}</style>

      {/* Hero */}
      {heroEl}

      {/* ── PUBLIC LAYOUT ── */}
      {!isAuth && (
        <>
          {/* Tab bar */}
          <div ref={pubTabRef} className="sticky top-16 z-20 bg-white border-b border-brand-border">
            <div className="max-w-6xl mx-auto px-6 sm:px-10 flex items-center">
              {([
                { key: 'overview', label: 'Overview' },
                { key: 'returns',  label: 'Return Analysis' },
                { key: 'brochure', label: 'Brochure' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setPubTab(key)
                    const el = pubTabRef.current
                    if (el) window.scrollTo({ top: el.offsetTop - el.offsetHeight, behavior: 'instant' })
                  }}
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
            <>
              <div className="max-w-6xl mx-auto px-6 sm:px-10">
                <SecondaryPillNav sections={overviewNavSections} desktopOnly />
                {aboutSection}
                {unitsAndPlanSection}

                {gallerySection}
                {locationSection}
                {amenitiesSection}
                <div className="py-10 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-text">Want independent analysis on this project?</p>
                    <p className="text-xs text-brand-muted mt-1">Honest advice from a buyer's agent. No cost to you.</p>
                  </div>
                  <button
                    onClick={() => document.getElementById('lead-gen-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-shrink-0 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    Get independent advice →
                  </button>
                </div>
                {faqSection}
              </div>
            </>
          )}

          {/* Return Analysis tab */}
          {pubTab === 'returns' && (
            <div className="max-w-6xl mx-auto px-6 sm:px-10 pb-20">
              <ReturnAnalysisPanel project={project} showFullAnalysis={false} desktopOnlyNav />
            </div>
          )}

          {/* Brochure tab */}
          {pubTab === 'brochure' && (
            <div className="max-w-6xl mx-auto px-6 sm:px-10 py-12">
              <div className="max-w-lg">
                <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Download brochure</p>
                <p className="text-sm text-brand-muted mb-6">Leave your details and we&apos;ll send you the full brochure, floor plans and payment schedule.</p>
                <BrochureForm projectSlug={project.slug} projectName={project.name} />
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
            <div className={`max-w-6xl mx-auto px-6 sm:px-10 flex items-center ${authTab === 'overview' ? 'border-b border-brand-border' : ''}`}>
              {([
                { key: 'overview', label: 'Overview' },
                { key: 'returns',  label: 'Return Analysis' },
                { key: 'brochure', label: 'Brochure' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setAuthTab(key)
                    const el = scrollNavRef.current
                    if (el) window.scrollTo({ top: el.offsetTop - el.offsetHeight, behavior: 'instant' })
                  }}
                  className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-colors ${
                    authTab === key
                      ? 'border-brand-bronze text-brand-bronze'
                      : 'border-transparent text-brand-hint hover:text-brand-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto py-3.5">
                <AdminEditLink resource="projects" slug={project.slug} label="Edit project" />
              </div>
            </div>

          </div>

          {/* Overview tab */}
          {authTab === 'overview' && (
            <>
              <div className="max-w-6xl mx-auto px-6 sm:px-10">
                <SecondaryPillNav sections={overviewNavSections} desktopOnly />
                {aboutSection}
                {unitsAndPlanSection}

                {gallerySection}
                {locationSection}
                {amenitiesSection}
                <div className="py-10 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-text">Want independent analysis on this project?</p>
                    <p className="text-xs text-brand-muted mt-1">Honest advice from a buyer's agent. No cost to you.</p>
                  </div>
                  <button
                    onClick={() => document.getElementById('lead-gen-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex-shrink-0 text-sm font-medium px-5 py-2.5 rounded-lg text-white transition-colors whitespace-nowrap"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    Get independent advice →
                  </button>
                </div>
                {faqSection}
              </div>
            </>
          )}

          {/* Brochure tab */}
          {authTab === 'brochure' && (
            <div className="max-w-6xl mx-auto px-6 sm:px-10">
              <BrochureTab slug={project.slug} />
            </div>
          )}

          {/* Return Analysis tab */}
          {authTab === 'returns' && (
            <div className="max-w-6xl mx-auto px-6 sm:px-10 space-y-10">
              {myTakeSection}
              <ReturnAnalysisPanel project={project} showFullAnalysis={true} desktopOnlyNav />

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

      {/* ── Lead gen footer (hidden on the brochure tab) ───────────────────── */}
      {(isAuth ? authTab : pubTab) !== 'brochure' && (
        <section id="lead-gen-form" className="border-t border-brand-border bg-white">
          <div className="px-6 sm:px-10 py-16 sm:py-20">
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3 text-center">Independent advice</p>
              <h2 className="text-2xl font-semibold text-brand-text mb-2 text-center">Get an honest view on {project.name}</h2>
              <p className="text-sm text-brand-muted mb-8 text-center">Independent analysis, no developer affiliation. No cost to you.</p>
              <LeadGenForm projectName={project.name} />
            </div>
          </div>
        </section>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => i !== null ? (i - 1 + images.length) % images.length : null)}
          onNext={() => setLightboxIndex(i => i !== null ? (i + 1) % images.length : null)}
        />
      )}

      {floorPlanUrl !== null && (
        <FloorPlanLightbox url={floorPlanUrl} onClose={() => setFloorPlanUrl(null)} />
      )}

    </div>
  )
}
