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

export type StoredDeal = { id: string; name: string; params: DealParams }

export type CompareEntry = {
  id: string
  name: string
  project: string
  grade: string
  score: number
  grossYield: number
  netYield: number
  annualCashflow: number
  displayCashOnCash: number
  irr: number | null
  totalReturnY5: number
  price: number
  pricePerSqft: number
  serviceChargePerSqft: number
  acquisitionCosts: number
  totalAllIn: number
  developer: string
  developerTier: number
  completion: string
  propertyType: string
}

export type ComparisonSnapshot = {
  type: 'comparison'
  deals: StoredDeal[]
}

// ── Builder ────────────────────────────────────────────────────────────────────

export function buildCompareEntry(deal: StoredDeal): CompareEntry {
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
    id: deal.id, name: deal.name, project: p.project ?? '',
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

/** Returns the single winning index, or -1 on tie / insufficient data. */
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

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-700',
  B: 'bg-emerald-100 text-emerald-700',
  C: 'bg-yellow-100 text-yellow-700',
  D: 'bg-orange-100 text-orange-700',
  F: 'bg-red-100 text-red-700',
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-bold flex-shrink-0 ${GRADE_COLORS[grade] ?? 'bg-gray-100 text-gray-500'}`}>
      {grade || '—'}
    </span>
  )
}

// ── Trophy icon (Tabler ti-trophy) ────────────────────────────────────────────

function Trophy() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block w-3.5 h-3.5 text-emerald-500 ml-1.5 flex-shrink-0 align-text-bottom"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
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

// ── Row types ─────────────────────────────────────────────────────────────────

type RowDef = {
  label: string
  cells: React.ReactNode[]
  winnerIdx: number
}

// ── Table sub-components ──────────────────────────────────────────────────────

const LABEL_CLS = 'sticky left-0 bg-white z-10 text-xs text-gray-500 font-medium py-2.5 pr-4 border-b border-gray-50 whitespace-nowrap'
const CELL_CLS  = 'text-sm font-medium text-gray-800 py-2.5 px-3 border-b border-gray-50 border-l border-gray-50 text-right'

function SectionRow({ label, n }: { label: string; n: number }) {
  return (
    <tr>
      <td className="sticky left-0 bg-gray-50 z-10 text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 pr-4 border-b border-gray-100">
        {label}
      </td>
      {Array.from({ length: n }, (_, i) => (
        <td key={i} className="bg-gray-50 border-b border-gray-100 border-l border-gray-100" />
      ))}
    </tr>
  )
}

function DataRow({ row }: { row: RowDef }) {
  return (
    <tr className="hover:bg-gray-50/50 transition-colors">
      <td className={LABEL_CLS}>{row.label}</td>
      {row.cells.map((cell, ci) => (
        <td key={ci} className={`${CELL_CLS} ${ci === row.winnerIdx ? 'text-emerald-600 font-semibold' : ''}`}>
          <span className="inline-flex items-center justify-end gap-0">
            {cell}
            {ci === row.winnerIdx && <Trophy />}
          </span>
        </td>
      ))}
    </tr>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CompareTable({ entries }: { entries: CompareEntry[] }) {
  const n = entries.length

  // ── Winner indices ─────────────────────────────────────────────────────────
  const devWinner        = findWinner(entries.map(e => e.developerTier), 'low')
  const scoreWinner      = findWinner(entries.map(e => e.score), 'high')
  const completionWinner = findCompletionWinner(entries.map(e => e.completion))
  const grossYldWinner   = findWinner(entries.map(e => e.grossYield), 'high')
  const netYldWinner     = findWinner(entries.map(e => e.netYield), 'high')
  const cashflowWinner   = findWinner(entries.map(e => e.annualCashflow), 'high')
  const cocWinner        = findWinner(entries.map(e => e.displayCashOnCash), 'high')
  const irrWinner        = findWinner(entries.map(e => e.irr), 'high')
  const totalRetWinner   = findWinner(entries.map(e => e.totalReturnY5), 'high')
  const ppsqftWinner     = findWinner(entries.map(e => e.pricePerSqft > 0 ? e.pricePerSqft : null), 'low')
  const scSqftWinner     = findWinner(entries.map(e => e.serviceChargePerSqft > 0 ? e.serviceChargePerSqft : null), 'low')

  // ── Row definitions ────────────────────────────────────────────────────────

  const overviewRows: RowDef[] = [
    {
      label: 'Developer',
      cells: entries.map(e => e.developer),
      winnerIdx: devWinner,
    },
    {
      label: 'Investment grade',
      cells: entries.map(e => e.grade ? <GradeBadge key={e.id} grade={e.grade} /> : '—'),
      winnerIdx: scoreWinner,
    },
    {
      label: 'Investment score',
      cells: entries.map(e => e.score > 0 ? `${e.score} / 100` : '—'),
      winnerIdx: scoreWinner,
    },
    {
      label: 'Completion',
      cells: entries.map(e => e.completion),
      winnerIdx: completionWinner,
    },
    {
      label: 'Property type',
      cells: entries.map(e => e.propertyType === 'secondary' ? 'Secondary' : 'Off-plan'),
      winnerIdx: -1,
    },
  ]

  const returnsRows: RowDef[] = [
    {
      label: 'Gross yield',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.grossYield) : '—'),
      winnerIdx: grossYldWinner,
    },
    {
      label: 'Net yield',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.netYield) : '—'),
      winnerIdx: netYldWinner,
    },
    {
      label: 'Annual cashflow',
      cells: entries.map(e => e.price > 0 ? `AED ${fmt(e.annualCashflow)}` : '—'),
      winnerIdx: cashflowWinner,
    },
    {
      label: 'Cash-on-cash',
      cells: entries.map(e => e.price > 0 ? fmtPct(e.displayCashOnCash) : '—'),
      winnerIdx: cocWinner,
    },
    {
      label: 'IRR (5yr)',
      cells: entries.map(e => e.irr !== null ? fmtPct(e.irr) : '—'),
      winnerIdx: irrWinner,
    },
    {
      label: 'Total 5yr return',
      cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalReturnY5)}` : '—'),
      winnerIdx: totalRetWinner,
    },
  ]

  const costsRows: RowDef[] = [
    {
      label: 'Purchase price',
      cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.price)}` : '—'),
      winnerIdx: -1,
    },
    {
      label: 'Price per sqft',
      cells: entries.map(e => e.pricePerSqft > 0 ? `AED ${fmt(e.pricePerSqft)}` : '—'),
      winnerIdx: ppsqftWinner,
    },
    {
      label: 'Service charge / sqft',
      cells: entries.map(e => e.serviceChargePerSqft > 0 ? `AED ${e.serviceChargePerSqft.toFixed(2)}` : '—'),
      winnerIdx: scSqftWinner,
    },
    {
      label: 'Total acquisition cost',
      cells: entries.map(e => e.price > 0 ? `AED ${fmtK(e.totalAllIn)}` : '—'),
      winnerIdx: -1,
    },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table
        className="w-full border-collapse"
        style={{ minWidth: `${160 + n * 200}px` }}
      >
        <colgroup>
          <col style={{ width: '160px', minWidth: '160px' }} />
          {entries.map((_, i) => <col key={i} />)}
        </colgroup>

        {/* ── Deal header row ── */}
        <thead>
          <tr className="border-b border-gray-100">
            <th className="sticky left-0 bg-white z-10 py-4 pl-0 pr-4" />
            {entries.map((e, ci) => (
              <th key={e.id} className={`py-4 px-3 text-left align-top ${ci > 0 ? 'border-l border-gray-100' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{e.name}</p>
                    {e.project && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{e.project}</p>
                    )}
                  </div>
                  {e.grade && <GradeBadge grade={e.grade} />}
                </div>
                <p className="text-xs text-gray-500 mb-2.5">{e.score} / 100</p>
                <Link
                  href={`/deals/${e.id}`}
                  target="_blank"
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Analyse →
                </Link>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* ── Overview ── */}
          <SectionRow label="Overview" n={n} />
          {overviewRows.map(row => <DataRow key={row.label} row={row} />)}

          {/* ── Returns ── */}
          <SectionRow label="Returns" n={n} />
          {returnsRows.map(row => <DataRow key={row.label} row={row} />)}

          {/* ── Costs ── */}
          <SectionRow label="Costs" n={n} />
          {costsRows.map(row => <DataRow key={row.label} row={row} />)}
        </tbody>
      </table>
    </div>
  )
}
