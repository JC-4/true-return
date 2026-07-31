import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { computeDealMetrics } from '@/lib/calculations'
import type { DealMetrics } from '@/lib/calculations'
import { adaptPaymentPlan, formatHandoverDate, paymentPlanSummary } from '@/lib/payment-plan'
import { fmtLocation } from '@/lib/format'
import ShortlistViewLogger from '@/components/ShortlistViewLogger'
import { defaultReturnInputs } from '@/lib/return-defaults'
import type { Project, UnitType, Shortlist, ShortlistEntry } from '@/lib/types'

// Every request must hit the database for fresh data. View logging is
// client-side (ShortlistViewLogger) so crawler fetches are never counted.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment shortlist — TrueReturn',
  robots: { index: false, follow: false },
}

type LoadedEntry = ShortlistEntry & { project: Project | null; unit_type: UnitType | null }
type LoadedShortlist = Shortlist & { entries: LoadedEntry[] }

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtAED(n: number | null | undefined): string {
  if (n == null || n === 0) return '—'
  return `AED ${Math.round(n).toLocaleString('en-US')}`
}

function fmtQuarter(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
}

function fmtPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(1)}%`
}

function fmtSqft(n: number | null | undefined): string {
  return n == null || n === 0 ? '—' : `${Math.round(n).toLocaleString('en-US')} sqft`
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

// Mirrors ReturnAnalysisPanel's computeDealMetrics call at load: the entry's
// stored assumptions override the panel's derived defaults field by field.
function entryMetrics(project: Project, unit: UnitType | null, assumptions: ShortlistEntry['assumptions']): DealMetrics | null {
  const basePrice = unit?.price_from ?? project.starting_price ?? 0
  if (basePrice <= 0) return null
  const planRows = adaptPaymentPlan(project.payment_plans, project.handover_date)
  const defaults = defaultReturnInputs(unit ?? undefined, basePrice)
  const handoverRow = planRows.find(r => r.handover) ?? planRows[planRows.length - 1]
  const defaultLtv = handoverRow ? Math.min(80, Math.max(20, Math.round(handoverRow.pct / 5) * 5)) : 80
  const a = assumptions ?? {}
  const ltvPct = a.ltvPct ?? defaultLtv
  return computeDealMetrics({
    propertyType: 'offplan',
    price:        basePrice,
    rent:         a.rent ?? defaults.rent,
    growth:       a.growth ?? defaults.growth,
    internalSqft: unit?.internal_sqft ?? 0,
    balconySqft:  unit?.balcony_sqft ?? 0,
    scRate:       project.service_charge_rate ?? 0,
    completion:   formatHandoverDate(project.handover_date),
    developer:    project.developer?.name ?? '',
    handoverValue: a.handoverValue ?? defaults.handoverValue,
    paymentPlan:  planRows,
    dldPct:       4,
    agencyFeePct: 0,
    adminFee:     4_200,
    mortgageOn:   a.financing === 'mortgage',
    depositPct:   100 - ltvPct,
    interestRate: a.mortgageRate ?? 4.5,
    termYears:    25,
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShortlistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('shortlists')
    .select('*, entries:shortlist_entries(*, project:projects(*, developer:developers(*)), unit_type:unit_types(*))')
    .eq('token', token)
    .single()
  if (error || !data) notFound()
  const shortlist = data as LoadedShortlist

  const entries = [...(shortlist.entries ?? [])]
    .filter((e): e is LoadedEntry & { project: Project } => !!e.project)
    .sort((a, b) => a.sort_order - b.sort_order)

  const rows = entries.map(entry => ({
    entry,
    metrics: entryMetrics(entry.project, entry.unit_type, entry.assumptions),
  }))

  // Context first, then cost, then outcome — each column reads down as an argument
  const tableRows: { label: string; value: (r: (typeof rows)[number]) => string }[] = [
    { label: 'Developer',        value: ({ entry })   => entry.project.developer?.name ?? '—' },
    { label: 'Location',         value: ({ entry })   => fmtLocation(entry.project) },
    { label: 'Size',             value: ({ entry })   => fmtSqft(entry.unit_type?.size_sqft_from) },
    { label: 'Price',            value: ({ entry })   => fmtAED(entry.unit_type?.price_from ?? entry.project.starting_price) },
    { label: 'Payment plan',     value: ({ entry })   => paymentPlanSummary(entry.project.payment_plans) ?? '—' },
    { label: 'Cash to handover', value: ({ metrics }) => metrics ? fmtAED(metrics.cashDeployedPreCompletion) : '—' },
    { label: 'Handover',         value: ({ entry })   => fmtQuarter(entry.project.handover_date) },
    { label: 'IRR (base case)',  value: ({ metrics }) => fmtPct(metrics?.irr) },
  ]

  return (
    <div className="bg-brand-bg min-h-screen">
      <ShortlistViewLogger token={token} event="open" />
      <div className="max-w-6xl mx-auto px-5 sm:px-10 py-10 sm:py-16">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1 className="text-2xl sm:text-3xl font-semibold text-brand-text">Investment shortlist</h1>
        <p className="text-sm text-brand-muted mt-1.5">Prepared for {shortlist.client_name}</p>

        {shortlist.intro && (
          <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-line mt-6 max-w-2xl">
            {shortlist.intro}
          </p>
        )}

        {/* ── Comparison table ───────────────────────────────────────────── */}
        <div className="mt-10">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Side by side</p>
          <div className="overflow-x-auto rounded-xl border border-brand-border bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white px-4 sm:px-5 py-4" style={{ minWidth: 130 }} />
                  {rows.map(({ entry }) => (
                    <th key={entry.id} className="text-left px-4 sm:px-5 py-4 align-top" style={{ minWidth: 170 }}>
                      <span className="block text-sm font-semibold text-brand-text leading-snug">{entry.project.name}</span>
                      {entry.unit_type && (
                        <span className="block text-xs text-brand-hint font-normal mt-0.5">{entry.unit_type.type}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => (
                  <tr key={row.label} className="border-t border-brand-border">
                    <td className="sticky left-0 z-10 bg-white px-4 sm:px-5 py-3.5 text-xs font-medium text-brand-muted whitespace-nowrap">
                      {row.label}
                    </td>
                    {rows.map(r => (
                      <td key={r.entry.id} className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-brand-text whitespace-nowrap">
                        {row.value(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-brand-hint mt-3 leading-relaxed">
            Comparison uses the unit I&apos;ve selected for each project and my own assumptions.
            You can adjust both on each project page. Cash to handover includes the 4% DLD
            transfer fee and the admin fee on top of the payment plan instalments.
          </p>
        </div>

        {/* ── Project cards ──────────────────────────────────────────────── */}
        {/* Two entries keep two columns at lg rather than leaving a gap */}
        <div className={`mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 ${rows.length >= 3 ? 'lg:grid-cols-3' : ''}`}>
          {rows.map(({ entry, metrics }, i) => (
            <Link
              key={entry.id}
              href={`/s/${encodeURIComponent(token)}/${entry.project.slug}`}
              className="flex flex-col bg-white border border-brand-border rounded-2xl overflow-hidden transition-colors hover:border-brand-bronze"
            >
              {entry.project.images?.[0] && (
                <div className="relative w-full aspect-[3/2]">
                  <Image
                    src={entry.project.images[0]}
                    alt={entry.project.name}
                    fill
                    priority={i === 0}
                    sizes={rows.length >= 3
                      ? '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 350px'
                      : '(max-width: 768px) 100vw, (max-width: 1152px) 50vw, 530px'}
                    className="object-cover"
                    style={{ objectPosition: 'center 40%' }}
                  />
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-brand-text">{entry.project.name}</p>
                  {entry.project.developer && (
                    <p className="text-xs text-brand-hint mt-0.5">{entry.project.developer.name}</p>
                  )}
                </div>
                {entry.recommended === true && (
                  <span
                    className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-white px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#A0784A' }}
                  >
                    Recommended
                  </span>
                )}
              </div>

              <p className="text-sm text-brand-muted leading-relaxed mt-3">{entry.note}</p>

              {/* Pushed to the card bottom so metrics align across a row */}
              <div className="mt-auto pt-5">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-1">Net yield</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtPct(metrics?.netYield)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-1">IRR (base)</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtPct(metrics?.irr)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-1">Cash to handover</p>
                    <p className="text-sm font-semibold text-brand-text">{metrics ? fmtAED(metrics.cashDeployedPreCompletion) : '—'}</p>
                  </div>
                </div>

                <p className="text-xs font-medium mt-5" style={{ color: '#A0784A' }}>View full analysis →</p>
              </div>
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  )
}
