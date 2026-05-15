'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DEVELOPERS, computeDealMetrics, parseCompletionDate, type PlanRow } from '@/lib/calculations'

// ── Types ──────────────────────────────────────────────────────────────────────

type DealParams = {
  propertyType?: string; propertySubType?: string
  price?: number; rent?: number; growth?: number
  internalSqft?: number; balconySqft?: number
  buaSqft?: number; plotSqft?: number
  serviceCharge?: number; dld?: number; agencyFee?: number; adminFee?: number
  completion?: string; developer?: string; handoverValue?: number
  paymentPlan?: string; mortgageOn?: boolean; depositPct?: number
  interestRate?: number; termYears?: number
  view?: string; unit?: string; project?: string
  emirate?: string; location?: string
}

type StoredDeal = { id: string; name: string; params: DealParams }
type ComparisonSnapshot = { type: 'comparison'; deals: StoredDeal[] }

type DealEntry = {
  id: string; name: string; project: string; unit: string
  grade: string; score: number
  grossYield: number; netYield: number; annualCashflow: number
  displayCashOnCash: number; irr: number | null; totalReturnY5: number
  price: number; pricePerSqft: number; serviceChargePerSqft: number
  acquisitionCosts: number; totalAllIn: number
  developer: string; developerTier: number
  completion: string; propertyType: string; propertySubType: string
  handoverValue: number; growth: number
  gainOnPaper: number; gainOnPaperPct: number
  projValueY5: number
  emirate: string; location: string
}

// ── Build entry (fresh from params) ──────────────────────────────────────────

function buildEntry(deal: StoredDeal): DealEntry {
  const p = deal.params
  const propertyType    = (p.propertyType ?? 'offplan') as 'offplan' | 'secondary'
  const propertySubType = (p.propertySubType ?? 'apartment') as 'apartment' | 'townhouse' | 'villa'
  const isApartment     = propertySubType === 'apartment'
  // buaSqft: explicit for townhouse/villa; falls back to internal+balcony for apartments
  const buaSqft = isApartment ? undefined : (p.buaSqft ?? ((p.internalSqft ?? 0) + (p.balconySqft ?? 0)))
  let paymentPlan: PlanRow[] = []
  try { paymentPlan = JSON.parse(p.paymentPlan ?? '[]') } catch { paymentPlan = [] }

  const m = computeDealMetrics({
    propertyType, price: p.price ?? 0, rent: p.rent ?? 0, growth: p.growth ?? 5,
    internalSqft: p.internalSqft ?? 0, balconySqft: p.balconySqft ?? 0, buaSqft,
    scRate: p.serviceCharge ?? 0, completion: p.completion ?? '',
    developer: p.developer ?? '', handoverValue: p.handoverValue ?? 0,
    paymentPlan, dldPct: p.dld ?? 4, agencyFeePct: p.agencyFee ?? 0, adminFee: p.adminFee ?? 0,
    mortgageOn: p.mortgageOn ?? false, depositPct: p.depositPct ?? 20,
    interestRate: p.interestRate ?? 4, termYears: p.termYears ?? 25,
  })

  const devObj = DEVELOPERS.find(d => d.name === (p.developer ?? ''))
  const developerTier = devObj ? devObj.tier : 3

  return {
    id: deal.id, name: deal.name,
    project: p.project ?? '', unit: p.unit ?? '',
    grade: m.grade, score: m.score,
    grossYield: m.grossYield, netYield: m.netYield,
    annualCashflow: m.annualCashflow, displayCashOnCash: m.displayCashOnCash,
    irr: m.irr, totalReturnY5: m.totalReturnY5,
    price: p.price ?? 0, pricePerSqft: m.pricePerSqft,
    serviceChargePerSqft: p.serviceCharge ?? 0,
    acquisitionCosts: m.acquisitionCosts, totalAllIn: m.totalAllIn,
    developer: p.developer || '—', developerTier,
    completion: p.completion || '—',
    propertyType: p.propertyType ?? 'offplan',
    propertySubType,
    handoverValue: p.handoverValue ?? 0,
    growth: p.growth ?? 5,
    gainOnPaper: m.gainOnPaper,
    gainOnPaperPct: m.gainOnPaperPct,
    projValueY5: m.projValueY5,
    emirate: p.emirate ?? 'Dubai',
    location: p.location ?? '',
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt    = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtPct = (n: number, dp = 1) => n.toFixed(dp) + '%'
const fmtK   = (n: number) => {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}${Math.round(abs / 1_000)}K`
  return `${sign}${Math.round(abs).toLocaleString()}`
}

// ── Winner logic ──────────────────────────────────────────────────────────────

function findWinner(values: (number | null | undefined)[], mode: 'high' | 'low'): number {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null && x.v !== undefined && !isNaN(x.v as number))
  if (valid.length < 2) return -1
  const best = mode === 'high'
    ? Math.max(...valid.map(x => x.v))
    : Math.min(...valid.map(x => x.v))
  const winners = valid.filter(x => x.v === best)
  return winners.length === 1 ? winners[0].i : -1
}

function findCompletionWinner(completions: string[]): number {
  const parsed = completions.map(s => parseCompletionDate(s))
  const valid  = parsed
    .map((d, i) => ({ d, i }))
    .filter((x): x is { d: Date; i: number } => x.d !== null)
  if (valid.length < 2) return -1
  const earliest = Math.min(...valid.map(x => x.d.getTime()))
  const winners  = valid.filter(x => x.d.getTime() === earliest)
  return winners.length === 1 ? winners[0].i : -1
}

// ── Grade badge ───────────────────────────────────────────────────────────────

const GRADE_BG: Record<string, string> = {
  A: '#10b981',
  B: '#f59e0b',
  C: '#ef4444',
  D: '#ef4444',
  F: '#ef4444',
}

function GradeBadge({ grade }: { grade: string }) {
  const bg = GRADE_BG[grade] ?? '#9ca3af'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 6,
      background: bg, color: '#fff',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {grade}
    </span>
  )
}

// ── Trophy icon ───────────────────────────────────────────────────────────────

function Trophy() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', width: 12, height: 12, marginRight: 4, verticalAlign: 'middle', flexShrink: 0 }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#10b981"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M8 21l8 0" />
      <path d="M12 17l0 4" />
      <path d="M7 4l10 0" />
      <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
      <circle cx="5" cy="9" r="2" />
      <circle cx="19" cy="9" r="2" />
    </svg>
  )
}

// ── Row tooltip ───────────────────────────────────────────────────────────────

function RowTooltip({ lines }: { lines: string[] }) {
  const [vis, setVis]         = useState(false)
  const [pos, setPos]         = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const reposition = useCallback(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ top: r.top - 8, left: r.left + r.width / 2 })
  }, [])

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button
        ref={ref}
        type="button"
        onMouseEnter={() => { reposition(); setVis(true) }}
        onMouseLeave={() => setVis(false)}
        onFocus={() => { reposition(); setVis(true) }}
        onBlur={() => setVis(false)}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          background: '#e4e4e7', border: 'none',
          color: '#71717a', fontSize: 9, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'help', flexShrink: 0, padding: 0,
        }}
        aria-label="More info"
      >?</button>
      {vis && mounted && createPortal(
        <span style={{
          position: 'fixed', zIndex: 200,
          width: 240,
          background: '#18181b', color: '#fff',
          fontSize: 11, lineHeight: 1.55, borderRadius: 8,
          padding: '8px 12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          top: pos.top, left: pos.left,
          transform: 'translate(-50%, -100%)',
        }}>
          {lines.map((l, i) => (
            <span
              key={i}
              style={{
                display: 'block',
                marginTop: i > 0 ? 4 : 0,
                ...(l.startsWith('=') || l.startsWith('Total') || l.startsWith('Off-plan') || l.startsWith('Secondary')
                  ? { color: '#a1a1aa', fontSize: 10 }
                  : {}),
              }}
            >{l}</span>
          ))}
          {/* Caret */}
          <span style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #18181b',
          }} />
        </span>,
        document.body
      )}
    </span>
  )
}

// ── Comparison table ──────────────────────────────────────────────────────────

const LABEL_W = 180
const COL_MIN = 220

type RowDef = { label: string; cells: ReactNode[]; winnerIdx: number; tooltip?: string[] }

function ComparisonTable({ entries }: { entries: DealEntry[] }) {
  const n = entries.length

  // Best deal (highest score) — gets mint top border on header cell
  const topIdx = findWinner(entries.map(e => e.score), 'high')

  // Winner indices — overview
  const devW       = findWinner(entries.map(e => e.developerTier), 'low')
  const scoreW     = findWinner(entries.map(e => e.score), 'high')
  const completW   = findCompletionWinner(entries.map(e => e.completion))

  // Winner indices — returns
  const grossYldW  = findWinner(entries.map(e => e.grossYield), 'high')
  const netYldW    = findWinner(entries.map(e => e.netYield), 'high')
  const cashflowW  = findWinner(entries.map(e => e.annualCashflow), 'high')
  const cocW       = findWinner(entries.map(e => e.displayCashOnCash), 'high')
  const irrW       = findWinner(entries.map(e => e.irr), 'high')
  const totalRetW  = findWinner(entries.map(e => e.totalReturnY5), 'high')

  // Winner indices — costs
  const ppsqftW    = findWinner(entries.map(e => e.pricePerSqft > 0 ? e.pricePerSqft : null), 'low')
  const scSqftW    = findWinner(entries.map(e => e.serviceChargePerSqft > 0 ? e.serviceChargePerSqft : null), 'low')

  // Winner indices — growth
  // Gain on paper: % gain for entries where handoverValue > price > 0
  const paperGainW = findWinner(entries.map(e =>
    e.handoverValue > 0 && e.price > 0 ? e.gainOnPaperPct : null
  ), 'high')

  // Capital gain (5yr): (projValueY5 − price) / price — uses handoverValue as growth
  // base for off-plan deals, matching computeDealMetrics
  const capGain5yrPct = entries.map(e =>
    e.price > 0 ? (e.projValueY5 - e.price) / e.price : null
  )
  const capGain5yrW = findWinner(capGain5yrPct, 'high')

  const overviewRows: RowDef[] = [
    { label: 'Location',         cells: entries.map(e => e.location ? `${e.location}, ${e.emirate}` : '—'), winnerIdx: -1 },
    { label: 'Developer',        cells: entries.map(e => e.developer),                                      winnerIdx: devW },
    { label: 'Investment score', cells: entries.map(e => e.score > 0 ? `${e.score} / 100` : '—'),          winnerIdx: scoreW },
    { label: 'Completion',       cells: entries.map(e => e.completion),                                     winnerIdx: completW },
    { label: 'Sale type',         cells: entries.map(e => e.propertyType === 'secondary' ? 'Secondary' : 'Off-plan'), winnerIdx: -1 },
    { label: 'Property subtype', cells: entries.map(e => e.propertySubType.charAt(0).toUpperCase() + e.propertySubType.slice(1)), winnerIdx: -1 },
  ]

  const costsRows: RowDef[] = [
    { label: 'Purchase price',         cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.price)}`                                   : '—'), winnerIdx: -1 },
    {
      label: 'Price per sqft',
      cells: entries.map(e => e.pricePerSqft > 0 ? `AED ${fmt(e.pricePerSqft)}` : '—'),
      winnerIdx: ppsqftW,
      tooltip: [
        'Purchase price ÷ total internal area.',
        'Lower is generally better value for the same location and spec.',
      ],
    },
    {
      label: 'Service charge / sqft',
      cells: entries.map(e => e.serviceChargePerSqft > 0 ? `AED ${parseFloat(e.serviceChargePerSqft.toFixed(1))}` : '—'),
      winnerIdx: scSqftW,
      tooltip: [
        'Annual service charge rate per square foot.',
        'Lower means lower ongoing costs. Multiply by your unit\'s sqft for the annual total.',
      ],
    },
    { label: 'Total acquisition cost', cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalAllIn)}` : '—'), winnerIdx: -1 },
  ]

  const returnsRows: RowDef[] = [
    {
      label: 'Gross yield',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.grossYield) : '—'),
      winnerIdx: grossYldW,
      tooltip: [
        'Annual rent ÷ purchase price.',
        'Shows raw rental income before deducting service charge or other costs.',
      ],
    },
    {
      label: 'Net yield',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.netYield) : '—'),
      winnerIdx: netYldW,
      tooltip: [
        '( Annual rent − service charge ) ÷ purchase price.',
        'The real income yield after running costs. Use this to compare rental performance across deals.',
      ],
    },
    {
      label: 'Annual cashflow',
      cells: entries.map(e => e.price > 0 ? `AED ${fmt(e.annualCashflow)}` : '—'),
      winnerIdx: cashflowW,
      tooltip: [
        'Mortgaged: net income − annual mortgage payments.',
        'Cash purchase: net income ( rent − service charge ).',
        'Negative means the mortgage costs more than the rent earns.',
      ],
    },
    {
      label: 'Cash-on-cash',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.displayCashOnCash) : '—'),
      winnerIdx: cocW,
      tooltip: [
        'Annual cashflow ÷ cash deployed.',
        'Mortgaged: leveraged return on equity ( deposit + acquisition costs ).',
        'Cash purchase: same as net yield.',
      ],
    },
    {
      label: 'IRR 5yr',
      cells: entries.map(e => e.irr !== null ? fmtPct(e.irr) : '—'),
      winnerIdx: irrW,
      tooltip: [
        'Internal rate of return on a 5-year hold.',
        'Accounts for timing of all cash flows, leverage, and sale proceeds at exit.',
        'The most complete single return metric — higher is better.',
      ],
    },
    {
      label: 'Total 5yr return',
      cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalReturnY5)}` : '—'),
      winnerIdx: totalRetW,
      tooltip: [
        'Net rental income over 5 years + projected capital gain.',
        '= ( net income × 5 ) + ( projected value − purchase price )',
        'Does not account for mortgage principal repayment or time value of money.',
      ],
    },
  ]

  const growthRows: RowDef[] = [
    {
      label: 'Est. value at handover',
      cells: entries.map(e =>
        e.handoverValue > 0 && e.price > 0 ? `AED ${fmtK(e.handoverValue)}` : '—'
      ),
      winnerIdx: -1,
    },
    {
      label: 'Gain on paper',
      cells: entries.map(e => {
        if (!(e.handoverValue > 0 && e.price > 0)) return '—'
        return `+AED ${fmtK(e.gainOnPaper)} (${fmtPct(e.gainOnPaperPct)})`
      }),
      winnerIdx: paperGainW,
      tooltip: [
        'Estimated handover value − purchase price.',
        'Unrealised gain while under construction. Depends on the handover value estimate.',
        'Only shown for off-plan deals with a handover value entered.',
      ],
    },
    {
      label: 'Projected value (5yr)',
      cells: entries.map(e => {
        if (!(e.price > 0)) return '—'
        // Off-plan: growth compounds from handoverValue; secondary: from price.
        // projValueY5 already encodes this via computeDealMetrics.
        return `AED ${fmtK(e.projValueY5)}`
      }),
      winnerIdx: -1,
    },
    {
      label: 'Capital gain (5yr)',
      cells: entries.map(e => {
        if (!(e.price > 0)) return '—'
        const gain = e.projValueY5 - e.price
        const pct  = (gain / e.price) * 100
        return `AED ${fmtK(gain)} (${fmtPct(pct)})`
      }),
      winnerIdx: capGain5yrW,
      tooltip: [
        'Projected exit value − purchase price.',
        'Off-plan: growth compounds from handover value.',
        'Secondary: growth compounds from purchase price.',
      ],
    },
  ]

  // Shared label cell style
  const labelCellStyle: React.CSSProperties = {
    fontSize: 12, color: '#71717a',
    padding: '11px 20px',
    whiteSpace: 'nowrap',
    borderRight: '0.5px solid #e4e4e7',
  }

  let rowIdx = 0

  const renderSection = (sectionLabel: string, rows: RowDef[]) => (
    <>
      <tr>
        <td
          colSpan={n + 1}
          style={{
            background: '#f4f4f5', color: '#71717a',
            fontSize: 11, fontWeight: 500,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 20px',
            borderTop: '2px solid #e4e4e7',
          }}
        >
          {sectionLabel}
        </td>
      </tr>
      {rows.map(row => {
        const bg = rowIdx++ % 2 === 0 ? '#fff' : '#fafafa'
        return (
          <tr key={row.label} style={{ background: bg, borderBottom: '0.5px solid #f0f0f0' }}>
            <td style={labelCellStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {row.label}
                {row.tooltip && <RowTooltip lines={row.tooltip} />}
              </span>
            </td>
            {row.cells.map((cell, ci) => {
              const isWinner = ci === row.winnerIdx
              return (
                <td
                  key={ci}
                  style={{
                    fontSize: 13,
                    color: isWinner ? '#10b981' : '#18181b',
                    fontWeight: 500,
                    textAlign: 'right',
                    padding: '11px 16px',
                    borderRight: ci < n - 1 ? '0.5px solid #e4e4e7' : 'none',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {isWinner && <Trophy />}
                    {cell}
                  </span>
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
      <table
        style={{
          tableLayout: 'fixed',
          width: '100%',
          minWidth: LABEL_W + n * COL_MIN,
          borderCollapse: 'collapse',
        }}
      >
        <colgroup>
          <col style={{ width: LABEL_W }} />
          {entries.map((_, i) => <col key={i} />)}
        </colgroup>

        {/* Sticky deal header */}
        <thead>
          <tr style={{
            position: 'sticky', top: 0, zIndex: 10,
            background: '#fff',
            borderBottom: '0.5px solid #e4e4e7',
          }}>
            <th style={{ padding: '16px 20px', background: '#fff' }} />
            {entries.map((e, ci) => (
              <th
                key={e.id}
                style={{
                  padding: '16px',
                  textAlign: 'left',
                  verticalAlign: 'top',
                  borderLeft: '0.5px solid #e4e4e7',
                  borderTop: ci === topIdx ? '2px solid #10b981' : 'none',
                  background: '#fff',
                  fontWeight: 'normal',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', marginBottom: 3, lineHeight: 1.35 }}>
                  {e.name}
                </div>
                {(e.project || e.unit) && (
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 10, lineHeight: 1.4 }}>
                    {[e.project, e.unit].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {e.grade && <GradeBadge grade={e.grade} />}
                  <span style={{ fontSize: 12, color: '#71717a' }}>{e.score} / 100</span>
                </div>
                <Link
                  href={`/deals/${e.id}`}
                  target="_blank"
                  style={{
                    fontSize: 11, fontWeight: 500,
                    color: '#10b981',
                    border: '0.5px solid #10b981',
                    borderRadius: 6,
                    padding: '3px 8px',
                    display: 'inline-block',
                    textDecoration: 'none',
                  }}
                >
                  Analyse →
                </Link>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {renderSection('Overview', overviewRows)}
          {renderSection('Costs', costsRows)}
          {renderSection('Returns', returnsRows)}
          {renderSection('Growth', growthRows)}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ── Inner page (uses useSearchParams) ─────────────────────────────────────────

function ComparePageInner() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)

  const [entries, setEntries]   = useState<DealEntry[]>([])
  const [rawDeals, setRawDeals] = useState<StoredDeal[]>([])
  const [loaded, setLoaded]     = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing]   = useState(false)

  useEffect(() => {
    if (ids.length === 0) { setLoaded(true); return }
    Promise.all(ids.map(id => fetch(`/api/user/deals/${id}`).then(r => r.json())))
      .then((deals: StoredDeal[]) => {
        const valid = deals.filter(d => d && d.id)
        setRawDeals(valid)
        setEntries(valid.map(buildEntry))
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  async function handleShare() {
    if (rawDeals.length < 2) return
    setSharing(true)
    try {
      const body: ComparisonSnapshot = { type: 'comparison', deals: rawDeals }
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const { id } = await res.json()
      const url = `${window.location.origin}/compare/${id}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url).catch(() => {})
    } finally {
      setSharing(false)
    }
  }

  if (!loaded) {
    return (
      <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Loading comparison…</p>
      </div>
    )
  }

  if (ids.length < 2 || entries.length < 2) {
    return (
      <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Select at least 2 deals to compare.</p>
          <Link href="/deals" style={{ fontSize: 14, fontWeight: 600, color: '#10b981', textDecoration: 'none' }}>
            ← Back to deals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Dark topbar */}
      <div style={{ background: '#18181b', flexShrink: 0 }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '20px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0, marginBottom: 3 }}>
              Deal comparison
            </p>
            <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
              {entries.length} deals · side by side
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <Link
              href="/deals"
              style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', textDecoration: 'none' }}
            >
              ← All deals
            </Link>
            {shareUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Link copied!</span>
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
                  style={{
                    fontSize: 12, fontWeight: 500, color: '#10b981',
                    border: '1px solid #10b981', borderRadius: 8,
                    padding: '6px 14px', background: 'transparent', cursor: 'pointer',
                  }}
                >
                  Copy again
                </button>
              </div>
            ) : (
              <button
                onClick={handleShare}
                disabled={sharing}
                style={{
                  fontSize: 12, fontWeight: 500, color: '#fff',
                  background: '#10b981', border: 'none',
                  borderRadius: 8, padding: '6px 16px',
                  cursor: sharing ? 'default' : 'pointer',
                  opacity: sharing ? 0.6 : 1,
                }}
              >
                {sharing ? 'Sharing…' : 'Share comparison'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile fallback (below md) */}
      <div className="md:hidden" style={{ padding: 24 }}>
        <div style={{
          background: '#fff', borderRadius: 16,
          border: '1px solid #f0f0f0', padding: 24, textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            This comparison is best viewed on a larger screen.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(e => (
              <Link
                key={e.id}
                href={`/deals/${e.id}`}
                style={{
                  display: 'block', padding: '10px 16px',
                  borderRadius: 8, fontSize: 14, fontWeight: 600,
                  background: '#f3f4f6', color: '#18181b', textDecoration: 'none',
                }}
              >
                {e.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop table — fills remaining height */}
      <div className="hidden md:block" style={{ flex: 1 }}>
        <ComparisonTable entries={entries} />
      </div>

    </div>
  )
}

// ── Page (Suspense wrapper for useSearchParams) ───────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#fafafa', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>Loading…</p>
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  )
}
