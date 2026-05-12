'use client'
import { useState, useEffect, Suspense } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { DEVELOPERS, computeDealMetrics, parseCompletionDate, type PlanRow } from '@/lib/calculations'

// ── Types ──────────────────────────────────────────────────────────────────────

type DealParams = {
  propertyType?: string; price?: number; rent?: number; growth?: number
  internalSqft?: number; balconySqft?: number
  serviceCharge?: number; dld?: number; agencyFee?: number; adminFee?: number
  completion?: string; developer?: string; handoverValue?: number
  paymentPlan?: string; mortgageOn?: boolean; depositPct?: number
  interestRate?: number; termYears?: number
  view?: string; unit?: string; project?: string
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
  completion: string; propertyType: string
}

// ── Build entry (fresh from params) ──────────────────────────────────────────

function buildEntry(deal: StoredDeal): DealEntry {
  const p = deal.params
  const propertyType = (p.propertyType ?? 'offplan') as 'offplan' | 'secondary'
  let paymentPlan: PlanRow[] = []
  try { paymentPlan = JSON.parse(p.paymentPlan ?? '[]') } catch { paymentPlan = [] }

  const m = computeDealMetrics({
    propertyType, price: p.price ?? 0, rent: p.rent ?? 0, growth: p.growth ?? 5,
    internalSqft: p.internalSqft ?? 0, balconySqft: p.balconySqft ?? 0,
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

// ── Comparison table ──────────────────────────────────────────────────────────

const LABEL_W = 160
const COL_MIN = 220

type RowDef = { label: string; cells: ReactNode[]; winnerIdx: number }

function ComparisonTable({ entries }: { entries: DealEntry[] }) {
  const n = entries.length

  // Winner indices
  const devW       = findWinner(entries.map(e => e.developerTier), 'low')
  const scoreW     = findWinner(entries.map(e => e.score), 'high')
  const completW   = findCompletionWinner(entries.map(e => e.completion))
  const grossYldW  = findWinner(entries.map(e => e.grossYield), 'high')
  const netYldW    = findWinner(entries.map(e => e.netYield), 'high')
  const cashflowW  = findWinner(entries.map(e => e.annualCashflow), 'high')
  const cocW       = findWinner(entries.map(e => e.displayCashOnCash), 'high')
  const irrW       = findWinner(entries.map(e => e.irr), 'high')
  const totalRetW  = findWinner(entries.map(e => e.totalReturnY5), 'high')
  const ppsqftW    = findWinner(entries.map(e => e.pricePerSqft > 0 ? e.pricePerSqft : null), 'low')
  const scSqftW    = findWinner(entries.map(e => e.serviceChargePerSqft > 0 ? e.serviceChargePerSqft : null), 'low')

  const overviewRows: RowDef[] = [
    { label: 'Developer',       cells: entries.map(e => e.developer),                                             winnerIdx: devW },
    { label: 'Investment score', cells: entries.map(e => e.score > 0 ? `${e.score} / 100` : '—'),                winnerIdx: scoreW },
    { label: 'Completion',      cells: entries.map(e => e.completion),                                            winnerIdx: completW },
    { label: 'Property type',   cells: entries.map(e => e.propertyType === 'secondary' ? 'Secondary' : 'Off-plan'), winnerIdx: -1 },
  ]

  const returnsRows: RowDef[] = [
    { label: 'Gross yield',      cells: entries.map(e => e.price > 0 ? fmtPct(e.grossYield)                    : '—'), winnerIdx: grossYldW },
    { label: 'Net yield',        cells: entries.map(e => e.price > 0 ? fmtPct(e.netYield)                      : '—'), winnerIdx: netYldW },
    { label: 'Annual cashflow',  cells: entries.map(e => e.price > 0 ? `AED ${fmt(e.annualCashflow)}`          : '—'), winnerIdx: cashflowW },
    { label: 'Cash-on-cash',     cells: entries.map(e => e.price > 0 ? fmtPct(e.displayCashOnCash)             : '—'), winnerIdx: cocW },
    { label: 'IRR 5yr',          cells: entries.map(e => e.irr !== null ? fmtPct(e.irr)                        : '—'), winnerIdx: irrW },
    { label: 'Total 5yr return', cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalReturnY5)}`         : '—'), winnerIdx: totalRetW },
  ]

  const costsRows: RowDef[] = [
    { label: 'Purchase price',         cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.price)}`                          : '—'), winnerIdx: -1 },
    { label: 'Price per sqft',         cells: entries.map(e => e.pricePerSqft > 0 ? `AED ${fmt(e.pricePerSqft)}`              : '—'), winnerIdx: ppsqftW },
    { label: 'Service charge / sqft',  cells: entries.map(e => e.serviceChargePerSqft > 0 ? `AED ${e.serviceChargePerSqft.toFixed(2)}` : '—'), winnerIdx: scSqftW },
    { label: 'Total acquisition cost', cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalAllIn)}`                     : '—'), winnerIdx: -1 },
  ]

  // Shared row styles
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
            background: '#18181b', color: '#fff',
            fontSize: 11, fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '8px 20px',
          }}
        >
          {sectionLabel}
        </td>
      </tr>
      {rows.map(row => {
        const bg = rowIdx++ % 2 === 0 ? '#fff' : '#fafafa'
        return (
          <tr key={row.label} style={{ background: bg, borderBottom: '0.5px solid #f0f0f0' }}>
            <td style={labelCellStyle}>{row.label}</td>
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
          {renderSection('Returns', returnsRows)}
          {renderSection('Costs', costsRows)}
        </tbody>
      </table>
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
      <div style={{
        background: '#18181b',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        flexShrink: 0,
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
