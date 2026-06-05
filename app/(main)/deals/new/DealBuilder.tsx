'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useCalculator } from '@/lib/hooks/useCalculator'
import { buildAndSolveIRR, PLAN_COLORS, type PlanRow, type DealMetrics, type ScoreBreakdown } from '@/lib/calculations'
import type { InitialValues } from '@/lib/hooks/useCalculator'

// ─── Types ────────────────────────────────────────────────────────────────────

type DealBuilderProps = {
  initialValues?: InitialValues & { dealId?: string; dealName?: string; bedrooms?: number | null; typology?: string | null }
  editingDealId?: string
  editingDealName?: string
  lockDeveloper?: boolean
  lockProject?: boolean
  /** Tailwind top-* class for the sticky summary panel. Defaults to top-20.
   *  Override when the page has additional sticky bars above (e.g. insight page). */
  stickyTop?: string
  /** When true, shows a "Save & share" button that snapshots the current deal params
   *  as a shareable insight URL. Only shown on the admin insight page. */
  showShare?: boolean
  /** When true, shows a "Save as default" button that persists current params as the
   *  default starting state for this project's insight page. Admin only. */
  showSaveDefault?: boolean
  /** When true, shows a "Load deal" button to pull in a previously saved deal for
   *  this project. Admin only. */
  showLoad?: boolean
  /**
   * When true, renders in compact/embedded mode for the project Analysis tab:
   * - Hides the page header and project selector (assume lockProject=true)
   * - Zone 2 (dark summary) appears full-width at top; Zone 1 inputs are collapsible
   * - Zone 3 shows as accordion on mobile, tabs on desktop
   */
  compact?: boolean
}

type ApiDeveloper = {
  id: string
  name: string
  slug: string
  tier?: number | null
}

type ApiUnitType = {
  id: string
  project_id: string
  type: string
  price_from: number
  size_sqft_from: number
  price_per_sqft: number
  bedrooms: number | null
  typology: string | null
}

type ApiProject = {
  id: string
  slug: string
  name: string
  developer_id: string
  unit_types?: ApiUnitType[]
}

type TabName = 'Overview' | 'Returns' | 'Growth' | 'Financing'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt  = (n: number) => Math.round(n).toLocaleString('en-US')
const fmtPct = (n: number, dp = 1) => n.toFixed(dp) + '%'
const fmtK = (n: number) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}K`
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const GRADE_VERDICT: Record<string, string> = {
  'A+': 'Exceptional deal', A: 'Great deal', B: 'Good deal', C: 'Average deal', D: 'Weak deal', F: 'Poor deal',
}
const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald-300', A: 'text-emerald-400', B: 'text-emerald-400', C: 'text-yellow-400',
  D: 'text-orange-400', F: 'text-red-400',
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Tooltip({ lines }: { lines: string[] }) {
  const [vis, setVis]   = useState(false)
  const [pos, setPos]   = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const reposition = useCallback(() => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ top: r.top - 8, left: r.left + r.width / 2 })
  }, [])
  return (
    <span className="inline-flex items-center ml-1">
      <button ref={ref} type="button"
        onMouseEnter={() => { reposition(); setVis(true) }} onMouseLeave={() => setVis(false)}
        onFocus={() => { reposition(); setVis(true) }} onBlur={() => setVis(false)}
        className="w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-[9px] font-bold flex items-center justify-center cursor-help focus:outline-none"
        aria-label="More info">?</button>
      {vis && mounted && createPortal(
        <span className="fixed z-[200] w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl pointer-events-none leading-relaxed"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-50%,-100%)' }}>
          {lines.map((l, i) => (
            <span key={i} className={`block ${i > 0 ? 'mt-1' : ''} ${l.startsWith('=') || l.startsWith('Total') ? 'border-t border-gray-700 pt-1 mt-1.5 font-semibold' : ''}`}>{l}</span>
          ))}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>,
        document.body
      )}
    </span>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

function CardHeader({ title }: { title: string }) {
  return <div className="px-5 pt-5 pb-3 border-b border-gray-50"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</p></div>
}

function StatRow({ label, value, mint, bold }: { label: string; value: string; mint?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-baseline py-2 border-b border-gray-50 last:border-0 ${bold ? 'pt-3' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${mint ? 'text-emerald-600' : bold ? 'text-gray-900' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, mint, tooltip }: {
  label: string; value: string; sub?: string; mint?: boolean; tooltip?: string[]
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1 flex items-center">
        {label}{tooltip && <Tooltip lines={tooltip} />}
      </p>
      <p className={`text-xl font-bold ${mint ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

type CalcRow = { label: string; value: string; negative?: boolean; isFinal?: boolean }

function CalcCard({ label, value, sub, mint, rows, formula }: {
  label: string; value: string; sub?: string; mint?: boolean
  rows: CalcRow[]; formula: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">{label}</p>
        <p className={`text-xl font-bold ${mint ? 'text-emerald-600' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {hovered && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-64 bg-white rounded-lg shadow-lg overflow-hidden"
          style={{ border: '0.5px solid #10b981' }}>
          {rows.map((row, i) => (
            <div key={i} className={`flex justify-between items-baseline px-3 py-1.5 ${i < rows.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <span className="text-xs text-gray-500 pr-2">{row.label}</span>
              <span className={`text-xs font-semibold tabular-nums flex-shrink-0 ${
                row.isFinal ? 'text-emerald-600' : row.negative ? 'text-red-500' : 'text-gray-800'
              }`}>{row.value}</span>
            </div>
          ))}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono leading-snug">{formula}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function RangeSlider({ label, value, min, max, step, display, onChange, prominent }: {
  label: string; value: number; min: number; max: number; step: number
  display: string; onChange: (v: number) => void; prominent?: boolean
}) {
  return (
    <div className={prominent ? 'p-4 bg-gray-50 rounded-xl' : ''}>
      <div className="flex justify-between mb-2">
        <span className={`text-sm ${prominent ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
        <span className={`text-sm font-bold ${prominent ? 'text-emerald-600' : 'text-gray-900'}`}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500" />
    </div>
  )
}

function HandoverSlider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  const [raw, setRaw]         = useState('')
  const [editing, setEditing] = useState(false)

  const commit = (text: string) => {
    const parsed = parseInt(text.replace(/[^0-9]/g, ''), 10)
    if (!isNaN(parsed) && parsed > 0) {
      onChange(Math.min(max, Math.max(min, parsed)))
    }
    setEditing(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-500">Est. value at handover</span>
        <input
          type="text"
          inputMode="numeric"
          value={editing ? raw : value > 0 ? `AED ${fmt(value)}` : ''}
          onFocus={() => { setRaw(value > 0 ? String(value) : ''); setEditing(true) }}
          onChange={e => setRaw(e.target.value)}
          onBlur={() => commit(raw)}
          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
          placeholder="AED"
          className="w-36 border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-[#18181b] focus:bg-white text-right"
        />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500" />
    </div>
  )
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function ScoreBreakdownPanel({ score, grade, breakdown }: {
  score: number; grade: string; breakdown: ScoreBreakdown
}) {
  void score; void grade
  const rows = [
    { label: 'Net yield', sub: `${breakdown.yieldPts.toFixed(1)} / 35`, pts: breakdown.yieldPts, max: 35 },
    {
      label: `Unleveraged IRR${breakdown.scoringIrr !== null ? ` (${breakdown.scoringIrr.toFixed(1)}%)` : ''}`,
      sub: `${breakdown.irrPts.toFixed(1)} / 35`, pts: breakdown.irrPts, max: 35,
    },
    { label: 'Developer tier', sub: `${breakdown.devPts} / 20`, pts: breakdown.devPts, max: 20 },
    {
      label: breakdown.preCompletionROE !== null
        ? `Pre-completion ROE (${breakdown.preCompletionROE.toFixed(1)}%)`
        : 'Secondary / property type',
      sub: `${breakdown.roePts} / 10`, pts: breakdown.roePts, max: 10,
    },
  ]
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-gray-500 truncate pr-2">{r.label}</span>
            <span className="text-xs font-semibold text-gray-800 flex-shrink-0">{r.sub}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (r.pts / r.max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PillGroup ─────────────────────────────────────────────────────────────────

function PillGroup<T extends string>({ options, value, onChange }: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors ${
            value === o.value
              ? 'bg-[#18181b] text-white shadow-sm'
              : 'text-[#71717a] hover:bg-[#e4e4e7]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

function NumberInput({
  label, value, onChange, prefix = '', suffix = '', placeholder = '0', hint,
}: {
  label: string; value: number; onChange: (v: number) => void
  prefix?: string; suffix?: string; placeholder?: string; hint?: string
}) {
  const [raw, setRaw]         = useState('')
  const [editing, setEditing] = useState(false)

  const display = editing ? raw : (value > 0 ? `${prefix}${fmt(value)}${suffix}` : '')

  const commit = (text: string) => {
    const parsed = parseFloat(text.replace(/[^0-9.]/g, ''))
    if (!isNaN(parsed)) onChange(parsed)
    setEditing(false)
  }

  return (
    <div>
      <label className="block text-xs font-medium text-[#71717a] mb-1.5">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        placeholder={placeholder}
        onFocus={() => { setRaw(value > 0 ? String(value) : ''); setEditing(true) }}
        onChange={e => setRaw(e.target.value)}
        onBlur={() => commit(raw)}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-[#18181b]"
      />
      {hint && <p className="text-[10px] text-[#a1a1aa] mt-1">{hint}</p>}
    </div>
  )
}

// ─── ROE card ─────────────────────────────────────────────────────────────────

function RoeCard({ m, price, rent, rentGrowth, interestRate, termYears }: {
  m: DealMetrics; price: number
  rent: number; rentGrowth: number
  interestRate: number; termYears: number
}) {
  const [hovered, setHovered] = useState(false)
  if (m.loanAmount <= 0 || m.upfrontCash <= 0) return null

  const equityDeployed = m.upfrontCash
  const mr = interestRate / 100 / 12
  const mp = m.monthlyPayment

  const balanceAfterYear = (y: number) => {
    const months = y * 12
    if (mr === 0) return Math.max(0, m.loanAmount - mp * months)
    return Math.max(0, m.loanAmount * Math.pow(1 + mr, months) - mp * (Math.pow(1 + mr, months) - 1) / mr)
  }
  const principalInYear = (y: number) => balanceAfterYear(y - 1) - balanceAfterYear(y)
  const cashflowInYear = (y: number) =>
    rent * Math.pow(1 + rentGrowth / 100, y - 1) - m.serviceCharge - m.annualMortgageCost

  const yr1Cf = cashflowInYear(1)
  const yr1Pr = principalInYear(1)
  const yr1Roe = equityDeployed > 0 ? ((yr1Cf + yr1Pr) / equityDeployed) * 100 : 0

  const sections = [1, 3, 5].map(y => {
    const cf = cashflowInYear(y)
    const pr = principalInYear(y)
    const total = cf + pr
    const roe = equityDeployed > 0 ? (total / equityDeployed) * 100 : 0
    return { year: y, cf, pr, total, roe }
  })

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-1">ROE (Yr 1)</p>
        <p className="text-xl font-bold text-emerald-600">{price > 0 ? fmtPct(yr1Roe) : '—'}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">return on equity deployed</p>
      </div>
      {hovered && (
        <div className="absolute top-full left-0 z-20 mt-1.5 w-72 bg-white rounded-lg shadow-lg overflow-hidden"
          style={{ border: '0.5px solid #10b981' }}>
          <div className="flex justify-between items-baseline px-3 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-500">Equity deployed</span>
            <span className="text-xs font-semibold text-gray-800 tabular-nums">AED {fmt(equityDeployed)}</span>
          </div>
          {sections.map((s, i) => (
            <div key={s.year} className={i > 0 ? 'border-t border-gray-100' : ''}>
              <div className="px-3 pt-2 pb-0.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Year {s.year}</p>
              </div>
              <div className="flex justify-between items-baseline px-3 py-1">
                <span className="text-xs text-gray-500">Annual cashflow</span>
                <span className={`text-xs font-semibold tabular-nums ${s.cf < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  AED {fmt(s.cf)}
                </span>
              </div>
              <div className="flex justify-between items-baseline px-3 py-1">
                <span className="text-xs text-gray-500">Principal repaid</span>
                <span className="text-xs font-semibold text-gray-800 tabular-nums">AED {fmt(s.pr)}</span>
              </div>
              <div className="flex justify-between items-baseline px-3 pt-1 pb-2">
                <span className="text-xs text-gray-500">ROE</span>
                <span className="text-xs font-semibold text-emerald-600 tabular-nums">{fmtPct(s.roe)}</span>
              </div>
            </div>
          ))}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono leading-snug">(cashflow + principal repaid) ÷ equity deployed</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function TabOverview({
  m, price, mortgageOn, handoverValue, propertyType, propertySubType,
  project, developer, unit, location, emirate, view, completion,
  internalSqft, balconySqft, buaSqft, plotSqft,
}: {
  m: DealMetrics; price: number; mortgageOn: boolean; handoverValue: number
  propertyType: string; propertySubType: string
  project: string; developer: string; unit: string
  location: string; emirate: string; view: string; completion: string
  internalSqft: number; balconySqft: number; buaSqft: number; plotSqft: number
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)
  const isApt = propertySubType === 'apartment'

  return (
    <div className="space-y-4">
      <div className="bg-[#18181b] rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-8">
        <div className="flex items-start gap-5 flex-shrink-0">
          <div className="w-[72px] h-[72px] rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-4xl font-bold text-white">{m.grade}</span>
          </div>
          <div>
            <p className="text-lg font-bold text-white mb-0.5">{GRADE_VERDICT[m.grade] ?? 'Deal analysis'}</p>
            <p className="text-sm text-zinc-400 mb-3">
              Investment score: <span className="text-white font-semibold">{m.score} / 100</span>
            </p>
            <div className="w-44 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.score}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 sm:ml-auto">
          {[
            { label: 'Purchase price',    value: `AED ${fmtK(price)}`, mint: false },
            { label: 'Net yield',         value: price > 0 ? fmtPct(m.netYield) : '—', mint: true },
            { label: 'IRR (5yr)',         value: m.irr !== null ? fmtPct(m.irr) : '—', mint: true },
            { label: 'Total return (5yr)', value: price > 0 ? `AED ${fmtK(m.totalReturnY5)}` : '—', mint: true },
          ].map(({ label, value, mint }) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-1">{label}</p>
              <p className={`text-lg font-bold ${mint ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Property" />
          <div className="px-5 py-2">
            {[
              { label: 'Location', value: location ? `${location}, ${emirate || 'Dubai'}` : '—' },
              { label: 'Developer', value: developer || '—' },
              { label: 'Project', value: project || '—' },
              { label: 'Unit', value: unit || '—' },
              { label: 'Sale type', value: propertyType === 'secondary' ? 'Secondary market' : 'Off-plan' },
              { label: 'Property subtype', value: propertySubType.charAt(0).toUpperCase() + propertySubType.slice(1) },
              ...(isApt ? [
                { label: 'Internal sqft', value: internalSqft ? `${internalSqft.toLocaleString()} ft²` : '—' },
                { label: 'Balcony sqft', value: balconySqft ? `${balconySqft.toLocaleString()} ft²` : '—' },
                { label: 'BUA', value: buaSqft ? `${buaSqft.toLocaleString()} ft²` : '—' },
              ] : [
                { label: 'BUA', value: buaSqft ? `${buaSqft.toLocaleString()} ft²` : '—' },
                { label: 'Plot size', value: plotSqft ? `${plotSqft.toLocaleString()} ft²` : '—' },
              ]),
              { label: 'View', value: view || '—' },
              { label: 'Completion', value: completion || '—' },
              { label: 'Price per sqft', value: m.pricePerSqft > 0 ? `AED ${fmt(m.pricePerSqft)}` : '—' },
            ].map(r => <StatRow key={r.label} label={r.label} value={r.value} />)}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Key numbers" />
            <div className="px-5 py-2">
              <StatRow label="Net yield" value={price > 0 ? fmtPct(m.netYield) : '—'} mint />
              <StatRow label="Annual cashflow" value={price > 0 ? `AED ${fmt(m.annualCashflow)}` : '—'} mint />
              <StatRow label="Total 5yr return" value={price > 0 ? `AED ${fmt(m.totalReturnY5)}` : '—'} mint />
              {handoverValue > 0 && (
                <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">Est. value at handover</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">AED {fmt(handoverValue)}</span>
                    <p className="text-xs text-gray-400 mt-0.5">+AED {fmt(handoverValue - price)} vs purchase price</p>
                  </div>
                </div>
              )}
              <StatRow label="IRR (5yr exit)" value={m.irr !== null ? fmtPct(m.irr) : '—'} mint />
            </div>
          </Card>

          <Card>
            <CardHeader title="Investment score" />
            <div className="px-5 py-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <span className={`text-2xl font-bold ${GRADE_COLOR[m.grade] ?? 'text-gray-400'} text-emerald-600`}>{m.grade}</span>
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-gray-900">{m.score} / 100</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowBreakdown(b => !b)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                {showBreakdown ? 'Hide' : 'Show'} breakdown
                <svg className={`w-3 h-3 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showBreakdown && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <ScoreBreakdownPanel score={m.score} grade={m.grade} breakdown={m.breakdown} />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Returns ─────────────────────────────────────────────────────────────

function TabReturns({
  m, mortgageOn, price, rent, setRent, interestRate, termYears,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number
  rent: number; setRent: (v: number) => void
  interestRate: number; termYears: number
}) {
  const [rentGrowth, setRentGrowth] = useState(0)

  const rentMin = price > 0 ? Math.max(30000, Math.floor(price * 0.02 / 5000) * 5000) : 0
  const rentMax = price > 0 ? (Math.ceil(price * 0.12 / 5000) * 5000 || 500000) : 500000

  let cumulative = 0
  const yrRows = [1, 2, 3, 4, 5].map(y => {
    const yearRent = rent * Math.pow(1 + rentGrowth / 100, y - 1)
    const netCf = yearRent - m.serviceCharge - (mortgageOn ? m.annualMortgageCost : 0)
    cumulative += netCf
    return { year: y, grossRent: yearRent, sc: m.serviceCharge, netCf, cumulative }
  })

  const breakEvenRent = m.serviceCharge + (mortgageOn ? m.annualMortgageCost : 0)

  const netYieldRows: CalcRow[] = [
    { label: 'Annual rent', value: `AED ${fmt(m.grossRent)}` },
    { label: 'Service charge (−)', value: `−AED ${fmt(m.serviceCharge)}`, negative: true },
    { label: 'Net annual income', value: `AED ${fmt(m.netIncome)}` },
    { label: 'Purchase price', value: `AED ${fmt(price)}` },
    { label: 'Net yield', value: price > 0 ? fmtPct(m.netYield) : '—', isFinal: true },
  ]
  const grossYieldRows: CalcRow[] = [
    { label: 'Annual rent', value: `AED ${fmt(m.grossRent)}` },
    { label: 'Purchase price', value: `AED ${fmt(price)}` },
    { label: 'Gross yield', value: price > 0 ? fmtPct(m.grossYield) : '—', isFinal: true },
  ]
  const cashflowRows: CalcRow[] = [
    { label: 'Annual rent', value: `AED ${fmt(m.grossRent)}` },
    { label: 'Service charge (−)', value: `−AED ${fmt(m.serviceCharge)}`, negative: true },
    ...(mortgageOn ? [{ label: 'Mortgage payments (−)', value: `−AED ${fmt(m.annualMortgageCost)}`, negative: true } as CalcRow] : []),
    { label: 'Net cashflow', value: `AED ${fmt(m.annualCashflow)}`, isFinal: true },
  ]
  const cashDeployed = mortgageOn ? m.upfrontCash : m.totalAllIn
  const cocRows: CalcRow[] = [
    { label: 'Net cashflow', value: `AED ${fmt(m.annualCashflow)}`, negative: m.annualCashflow < 0 },
    ...(mortgageOn
      ? [
          { label: 'Deposit', value: `AED ${fmt(m.depositAmount)}` } as CalcRow,
          { label: 'Acquisition costs', value: `AED ${fmt(m.acquisitionCosts)}` } as CalcRow,
          { label: 'Cash deployed', value: `AED ${fmt(cashDeployed)}` } as CalcRow,
        ]
      : [{ label: 'Cash deployed (total all-in)', value: `AED ${fmt(cashDeployed)}` } as CalcRow]),
    { label: 'Cash-on-cash', value: price > 0 ? fmtPct(m.displayCashOnCash) : '—', isFinal: true },
  ]

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-2 gap-4 ${mortgageOn ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <CalcCard label="Net yield" value={price > 0 ? fmtPct(m.netYield) : '—'}
          sub="After service charge" mint rows={netYieldRows} formula="net income ÷ purchase price" />
        <CalcCard label="Gross yield" value={price > 0 ? fmtPct(m.grossYield) : '—'}
          sub={`AED ${fmt(m.grossRent)} / yr`} rows={grossYieldRows} formula="annual rent ÷ purchase price" />
        <CalcCard label="Annual cashflow" value={price > 0 ? `AED ${fmt(m.annualCashflow)}` : '—'}
          sub={mortgageOn ? 'net income – mortgage' : 'net income'} rows={cashflowRows}
          formula={mortgageOn ? 'rent − service charge − mortgage' : 'rent − service charge'} />
        <CalcCard label="Cash-on-cash" value={price > 0 ? fmtPct(m.displayCashOnCash) : '—'}
          sub={mortgageOn ? 'leveraged return' : 'unleveraged'}
          mint={m.displayCashOnCash >= 0} rows={cocRows} formula="net cashflow ÷ cash deployed" />
        {mortgageOn && (
          <RoeCard m={m} price={price} rent={rent} rentGrowth={rentGrowth}
            interestRate={interestRate} termYears={termYears} />
        )}
      </div>

      <Card className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Break-even rent</p>
          <p className="text-sm text-gray-400">
            {mortgageOn ? 'Minimum rent to cover service charge + mortgage' : 'Minimum rent to cover service charge'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-gray-900">AED {fmt(breakEvenRent)}</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Year-by-year cashflow" />
        <div className="px-5 pb-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Year', 'Gross rent', 'Service charge', 'Net cashflow', 'Cumulative'].map(h => (
                  <th key={h} className="text-left py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yrRows.map(r => (
                <tr key={r.year} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 font-medium text-gray-700">Yr {r.year}</td>
                  <td className="py-2.5 tabular-nums text-gray-600">AED {fmt(r.grossRent)}</td>
                  <td className="py-2.5 tabular-nums text-red-500">–AED {fmt(r.sc)}</td>
                  <td className={`py-2.5 tabular-nums font-semibold ${r.netCf >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    AED {fmt(r.netCf)}
                  </td>
                  <td className={`py-2.5 tabular-nums font-semibold ${r.cumulative >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                    AED {fmt(r.cumulative)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Variables" />
        <div className="px-5 pb-5 pt-3 space-y-5">
          <RangeSlider label="Annual rent" value={rent} min={rentMin} max={rentMax} step={5000}
            display={`AED ${fmt(rent)}`} onChange={setRent} />
          <RangeSlider label="Annual rent growth" value={rentGrowth} min={0} max={10} step={0.5}
            display={fmtPct(rentGrowth)} onChange={setRentGrowth} />
        </div>
      </Card>
    </div>
  )
}

// ─── Tab: Growth ──────────────────────────────────────────────────────────────

function TabGrowth({
  m, mortgageOn, price, growth, setGrowth, propertyType, handoverValue, setHandoverValue,
  interestRate, termYears, paymentPlan, completion,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number; growth: number; setGrowth: (v: number) => void
  propertyType: 'offplan' | 'secondary'; handoverValue: number; setHandoverValue: (v: number) => void
  interestRate: number; termYears: number; paymentPlan: PlanRow[]; completion: string
}) {
  const monthlyRate = interestRate / 100 / 12
  const termMonths = termYears * 12
  const mp = mortgageOn
    ? (monthlyRate > 0
      ? m.loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
      : m.loanAmount / termMonths)
    : 0
  const mortgageBalance = (y: number) => {
    if (!mortgageOn) return 0
    if (monthlyRate > 0) {
      return Math.max(0, m.loanAmount * Math.pow(1 + monthlyRate, y * 12) - mp * (Math.pow(1 + monthlyRate, y * 12) - 1) / monthlyRate)
    }
    return Math.max(0, m.loanAmount - mp * y * 12)
  }

  const offplanWithHandover = propertyType === 'offplan' && handoverValue > 0
  const growthBase = offplanWithHandover ? handoverValue : price

  const equityRows = [0, 1, 2, 3, 4, 5].map(y => {
    const propValue = y === 0 ? growthBase : growthBase * Math.pow(1 + growth / 100, y)
    const balance = mortgageBalance(y)
    const equity = propValue - balance
    return { year: y, propValue, balance, equity, equityPct: propValue > 0 ? (equity / propValue) * 100 : 0 }
  })

  const conservativeRate = Math.round(growth * 0.6 * 10) / 10
  const optimisticRate = Math.round(growth * 1.5 * 10) / 10
  const cashDeployed = mortgageOn ? m.upfrontCash : m.totalAllIn

  const scenarios = [
    { label: 'Conservative', rate: conservativeRate, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Base case', rate: growth, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Optimistic', rate: optimisticRate, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  ].map(s => {
    const exitVal = growthBase * Math.pow(1 + s.rate / 100, 5)
    const capitalGain = exitVal - price
    const rentalIncome5 = m.netIncome * 5
    const totalRet = capitalGain + rentalIncome5
    const rocd = cashDeployed > 0 ? (totalRet / cashDeployed) * 100 : null
    const irr = buildAndSolveIRR({
      price, netIncome: m.netIncome, growth: s.rate,
      paymentPlan, completion, handoverValue, propertyType,
      mortgageOn, annualMortgageCost: m.annualMortgageCost, upfrontCash: m.upfrontCash,
      loanAmount: m.loanAmount, monthlyPayment: mp, monthlyRate,
    })
    return { ...s, exitVal, capitalGain, rentalIncome5, totalRet, rocd, irr,
      exitValPct: price > 0 ? (capitalGain / price) * 100 : 0 }
  })

  return (
    <div className="space-y-4">
      {price > 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total 5yr return (base case)</p>
            <p className="text-sm text-emerald-600">Rental income + capital gain at {growth.toFixed(1)}%/yr growth</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 flex-shrink-0">AED {fmtK(m.totalReturnY5)}</p>
        </div>
      )}

      {m.gainOnPaper !== 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">Gain on paper at handover</p>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] text-emerald-600 mb-0.5">Paper gain</p>
              <p className="text-xl font-bold text-emerald-700">
                {m.gainOnPaper >= 0 ? '+' : ''}AED {fmt(m.gainOnPaper)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 mb-0.5">vs purchase price</p>
              <p className="text-xl font-bold text-emerald-700">{m.gainOnPaperPct >= 0 ? '+' : ''}{fmtPct(m.gainOnPaperPct)}</p>
            </div>
            <div>
              <p className="text-[10px] text-emerald-600 mb-0.5">Return on capital deployed</p>
              <p className="text-xl font-bold text-emerald-700">
                {m.preCompletionROE > 0 ? `${m.preCompletionROE.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title={`Capital growth projection (${growth.toFixed(1)}%/yr)`} />
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {m.projections.map((proj, i) => {
            const isHandover = i === 0 && offplanWithHandover
            return (
              <div key={proj.label}
                className={`rounded-xl p-3 text-center border ${isHandover ? 'bg-[#f0fdf9] border-[#6ee7b7]' : 'bg-gray-50 border-transparent'}`}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${isHandover ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {proj.label}
                </p>
                <p className={`text-sm font-bold ${isHandover ? 'text-emerald-700' : 'text-gray-900'}`}>
                  AED {fmtK(proj.value)}
                </p>
                <p className={`text-[10px] mt-0.5 ${proj.gain >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {proj.gain >= 0 ? '+' : ''}AED {fmtK(proj.gain)}
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      {mortgageOn && (
        <Card>
          <CardHeader title="Equity position" />
          <div className="px-5 pb-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Year', 'Property value', 'Mortgage balance', 'Equity', 'Equity %'].map(h => (
                    <th key={h} className="text-left py-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {equityRows.map(r => (
                  <tr key={r.year} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 font-medium text-gray-700">{r.year === 0 ? (offplanWithHandover ? 'Handover' : 'Today') : `Yr ${r.year}`}</td>
                    <td className="py-2.5 tabular-nums text-gray-700">AED {fmt(r.propValue)}</td>
                    <td className="py-2.5 tabular-nums text-red-500">AED {fmt(r.balance)}</td>
                    <td className="py-2.5 tabular-nums font-semibold text-emerald-600">AED {fmt(r.equity)}</td>
                    <td className="py-2.5 tabular-nums text-gray-600">{fmtPct(r.equityPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Variables" />
        <div className="px-5 pb-5 pt-3 space-y-5">
          <RangeSlider label="Capital growth" value={growth} min={0} max={15} step={0.5}
            display={fmtPct(growth)} onChange={setGrowth} />
          {propertyType === 'offplan' && price > 0 && (
            <HandoverSlider
              value={handoverValue}
              min={Math.floor(price * 0.85 / 100000) * 100000}
              max={Math.ceil(price * 1.6 / 100000) * 100000}
              step={50000}
              onChange={setHandoverValue}
            />
          )}
        </div>
      </Card>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">Exit scenarios (5yr hold)</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {scenarios.map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 ${s.bg} ${s.border}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${s.color}`}>{s.label}</p>
              <p className="text-[10px] text-gray-400 mb-4">{s.rate.toFixed(1)}% annual growth</p>
              <div className="space-y-2.5">
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-[10px] text-gray-500 flex-shrink-0">Exit value</p>
                  <p className={`text-sm font-bold ${s.color} tabular-nums`}>AED {fmt(s.exitVal)}</p>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-[10px] text-gray-500 flex-shrink-0">Capital gain</p>
                  <p className={`text-xs font-semibold ${s.color} tabular-nums`}>
                    {s.exitValPct >= 0 ? '+' : ''}AED {fmt(s.capitalGain)}
                  </p>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-[10px] text-gray-500 flex-shrink-0">Total rental income (5yr)</p>
                  <p className="text-xs font-semibold text-gray-700 tabular-nums">AED {fmt(s.rentalIncome5)}</p>
                </div>
                <div className="flex justify-between items-baseline gap-2 pt-2 border-t border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-600 flex-shrink-0">Total 5yr return</p>
                  <p className={`text-sm font-bold ${s.color} tabular-nums`}>AED {fmt(s.totalRet)}</p>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-[10px] text-gray-500 flex-shrink-0">IRR</p>
                  <p className="text-xs font-semibold text-gray-700 tabular-nums">
                    {s.irr !== null ? fmtPct(s.irr) : '—'}
                  </p>
                </div>
                {s.rocd !== null && (
                  <div className="flex justify-between items-baseline gap-2">
                    <p className="text-[10px] text-gray-500 flex-shrink-0">Return on capital deployed</p>
                    <p className={`text-xs font-semibold ${s.color} tabular-nums`}>
                      {s.rocd >= 0 ? '+' : ''}{fmtPct(s.rocd)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Financing ───────────────────────────────────────────────────────────

function TabFinancing({
  m, mortgageOn, price, paymentPlan,
  dldPct, agencyFeePct, adminFee,
  depositPct, setDepositPct, interestRate, setInterestRate, termYears,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number; paymentPlan: PlanRow[]
  dldPct: number; agencyFeePct: number; adminFee: number
  depositPct: number; setDepositPct: (v: number) => void
  interestRate: number; setInterestRate: (v: number) => void; termYears: number
}) {
  const spread = m.netYield - interestRate
  const totalInterest = mortgageOn ? m.monthlyPayment * termYears * 12 - m.loanAmount : 0

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#18181b] p-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
          {mortgageOn ? 'Cash required to complete' : 'Total cash required'}
        </p>
        <p className="text-3xl font-bold text-white mb-1">
          AED {fmt(mortgageOn ? m.upfrontCash : m.totalAllIn)}
        </p>
        {mortgageOn && (
          <p className="text-sm text-zinc-400">
            Deposit AED {fmt(m.depositAmount)} + acquisition costs AED {fmt(m.acquisitionCosts)}
          </p>
        )}
      </div>

      {mortgageOn && (
        <Card className="p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Total cost of debt</p>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">Total interest paid ({termYears}yr term)</p>
              <p className="text-xl font-bold text-red-600">AED {fmt(totalInterest)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 mb-0.5">Total mortgage payments</p>
              <p className="text-lg font-semibold text-gray-800">AED {fmt(m.monthlyPayment * termYears * 12)}</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Acquisition costs" />
        <div className="px-5 py-2">
          <StatRow label="Property price" value={`AED ${fmt(price)}`} />
          <StatRow label={`DLD fee (${dldPct}%)`} value={`AED ${fmt(m.dldFee)}`} />
          {agencyFeePct > 0 && <StatRow label={`Agency fee (${agencyFeePct}%)`} value={`AED ${fmt(m.agencyFeeAmt)}`} />}
          {adminFee > 0 && <StatRow label="Admin fee" value={`AED ${fmt(adminFee)}`} />}
          <div className="border-t border-gray-100 mt-1">
            <StatRow label="Total all-in" value={`AED ${fmt(m.totalAllIn)}`} bold />
          </div>
        </div>
      </Card>

      {paymentPlan.length > 0 && (
        <Card>
          <CardHeader title="Payment plan" />
          <div className="px-5 pb-5 pt-3">
            <div className="flex h-3 rounded-full overflow-hidden mb-5">
              {paymentPlan.map((row, i) => (
                <div key={row.id ?? i}
                  style={{ width: `${row.pct}%`, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                  title={`${row.label}: ${row.pct}%`} />
              ))}
            </div>
            <div className="space-y-2">
              {paymentPlan.map((row, i) => (
                <div key={row.id ?? i} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm text-gray-800 truncate flex items-center gap-1.5">
                      {row.label}
                      {row.handover && <span className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded">Handover</span>}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{row.date}</span>
                  </div>
                  <div className="text-right flex-shrink-0 w-32">
                    <span className="text-sm font-semibold text-gray-900">{row.pct}%</span>
                    <span className="text-xs text-gray-400 ml-1.5">AED {fmt(price * row.pct / 100)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {mortgageOn && (
        <Card>
          <CardHeader title="Mortgage" />
          <div className="px-5 pb-5 pt-4 space-y-5">
            <RangeSlider label="Deposit" value={depositPct} min={10} max={80} step={5}
              display={`${depositPct}%  (AED ${fmt(m.depositAmount)})`}
              onChange={setDepositPct} prominent />
            <RangeSlider label="Interest rate" value={interestRate} min={2} max={10} step={0.1}
              display={`${interestRate.toFixed(1)}%`}
              onChange={setInterestRate} prominent />
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-gray-100">
              {[
                { label: 'Loan amount', value: `AED ${fmt(m.loanAmount)}` },
                { label: 'Deposit amount', value: `AED ${fmt(m.depositAmount)}` },
                { label: 'Monthly payment', value: `AED ${fmt(m.monthlyPayment)}` },
                { label: 'Annual mortgage cost', value: `AED ${fmt(m.annualMortgageCost)}` },
                { label: `Total interest (${termYears}yr)`, value: `AED ${fmt(totalInterest)}` },
                {
                  label: 'Yield spread',
                  value: `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`,
                  special: spread >= 0 ? 'mint' : 'red',
                },
              ].map(({ label, value, special }) => (
                <div key={label}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
                  <p className={`text-sm font-semibold ${special === 'mint' ? 'text-emerald-600' : special === 'red' ? 'text-red-600' : 'text-gray-900'}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── AddDeveloperModal ────────────────────────────────────────────────────────

function AddDeveloperModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (dev: ApiDeveloper) => void
}) {
  const [name, setName]       = useState('')
  const [slug, setSlug]       = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(name))
  }, [name, slugEdited])

  async function handleCreate() {
    if (!name.trim() || !slug.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/developers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      const data = await res.json() as ApiDeveloper & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to create developer'); return }
      onCreated(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add developer</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Emaar"
              className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Slug</label>
            <input value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
              placeholder="e.g. emaar"
              className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium border border-[#e4e4e7] text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={loading || !name.trim() || !slug.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#18181b] text-white hover:bg-[#27272a] disabled:opacity-50">
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadableDeal = { id: string; name: string; savedAt: string; params: Record<string, unknown> }

// ─── LoadDealModal ────────────────────────────────────────────────────────────

function LoadDealModal({ deals, loading, onClose, onLoad }: {
  deals: LoadableDeal[]
  loading: boolean
  onClose: () => void
  onLoad: (deal: LoadableDeal) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Load from saved deals</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-6">Loading…</p>
        ) : deals.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No saved deals found for this project.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto -mx-1 px-1">
            {deals.map(deal => (
              <button
                key={deal.id}
                onClick={() => onLoad(deal)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-[#e4e4e7] transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{deal.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(deal.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </button>
            ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── DupModal ─────────────────────────────────────────────────────────────────

function DupModal({ existingName, onOverwrite, onSaveAsNew, onCancel, loading }: {
  existingName: string
  onOverwrite: () => void
  onSaveAsNew: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Duplicate deal name</h2>
        <p className="text-sm text-gray-500 mb-5">
          A deal named <span className="font-medium text-gray-700">&ldquo;{existingName}&rdquo;</span> already
          exists. Do you want to overwrite it or save as a new deal?
        </p>
        <div className="space-y-2">
          <button
            onClick={onOverwrite}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-[#18181b] hover:bg-[#27272a] disabled:opacity-50 text-white transition-colors"
          >
            {loading ? 'Saving…' : 'Overwrite existing deal'}
          </button>
          <button
            onClick={onSaveAsNew}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[#e4e4e7] text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Save as new deal
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SaveModal ────────────────────────────────────────────────────────────────

function SaveModal({
  defaultName,
  onClose,
  onSave,
  loading,
}: {
  defaultName: string
  onClose: () => void
  onSave: (name: string) => void
  loading: boolean
}) {
  const [name, setName] = useState(defaultName)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Save deal</h2>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Deal name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Emaar Marina Heights 2BR"
            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm font-medium border border-[#e4e4e7] text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(name)} disabled={loading || !name.trim()}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-[#18181b] text-white hover:bg-[#27272a] disabled:opacity-50">
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DealBuilder (main export) ────────────────────────────────────────────────

export default function DealBuilder({
  initialValues,
  editingDealId,
  editingDealName,
  lockDeveloper = false,
  lockProject   = false,
  stickyTop     = 'top-20',
  showShare     = false,
  showSaveDefault = false,
  showLoad      = false,
  compact       = false,
}: DealBuilderProps) {
  const router = useRouter()
  const c = useCalculator(initialValues)

  // ── Zone 1 state ──
  const [manualMode, setManualMode]         = useState(false)
  const [developers, setDevelopers]         = useState<ApiDeveloper[]>([])
  const [projects, setProjects]             = useState<ApiProject[]>([])
  const [selectedDeveloperId, setSelectedDeveloperId] = useState(initialValues?.developerId ?? '')
  const [selectedProjectId, setSelectedProjectId]     = useState('')
  const [selectedBedrooms, setSelectedBedrooms]       = useState<number | null | 'unset'>(
    initialValues?.bedrooms !== undefined ? initialValues.bedrooms : 'unset'
  )
  const [selectedTypology, setSelectedTypology]       = useState<string | null>(
    initialValues?.typology ?? null
  )
  const [showAddDev, setShowAddDev]         = useState(false)

  // ── Save state ──
  const [showSaveModal, setShowSaveModal]   = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [savedDealId,   setSavedDealId]     = useState<string | null>(editingDealId ?? null)
  const [savedDealName, setSavedDealName]   = useState<string | null>(editingDealName ?? null)
  const [dupModal, setDupModal]             = useState<{ existingId: string; existingName: string; body: object } | null>(null)

  // ── Share state ──
  const [sharing,     setSharing]     = useState(false)
  const [shareUrl,    setShareUrl]    = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  // ── Save-as-default state ──
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultSaved,  setDefaultSaved]  = useState(false)

  // ── Load-deal state ──
  const [showLoadModal,  setShowLoadModal]  = useState(false)
  const [loadableDeals,  setLoadableDeals]  = useState<LoadableDeal[]>([])
  const [loadingDeals,   setLoadingDeals]   = useState(false)

  // ── Tab state ──
  const [activeTab, setActiveTab]           = useState<TabName>('Overview')
  const [activeAccordion, setActiveAccordion] = useState<TabName | null>(null)

  // ── Compact mode: assumptions panel visibility ──
  const [assumptionsOpen, setAssumptionsOpen] = useState(true)

  // ── Acquisition costs collapsed ──
  const [showAcqCosts, setShowAcqCosts]     = useState(false)

  // Load developers on mount
  useEffect(() => {
    fetch('/api/developers')
      .then(r => {
        if (!r.ok) throw new Error(`/api/developers ${r.status}`)
        return r.json() as Promise<ApiDeveloper[]>
      })
      .then(data => setDevelopers(data))
      .catch(err => console.error('[DealBuilder] Failed to load developers:', err))
  }, [])

  // Load projects when developer changes
  useEffect(() => {
    if (!selectedDeveloperId) { setProjects([]); return }
    fetch(`/api/projects?developerId=${selectedDeveloperId}`)
      .then(r => {
        if (!r.ok) throw new Error(`/api/projects ${r.status}`)
        return r.json() as Promise<ApiProject[]>
      })
      .then(data => setProjects(data))
      .catch(err => console.error('[DealBuilder] Failed to load projects:', err))
  }, [selectedDeveloperId])

  // If initialValues has a developerId, auto-select that developer
  useEffect(() => {
    if (initialValues?.developerId) {
      setSelectedDeveloperId(initialValues.developerId)
    }
  }, [initialValues?.developerId])

  // When developers load (edit mode), sync the tier for the pre-selected developer.
  // Handles the case where selectedDeveloperId was set from initialValues before
  // the developers list arrived — without this the tier would stay null until the
  // user re-selects the developer manually.
  useEffect(() => {
    if (!selectedDeveloperId || developers.length === 0) return
    const dev = developers.find(d => d.id === selectedDeveloperId)
    if (dev) c.setDeveloperTier(dev.tier ?? null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [developers, selectedDeveloperId])

  // When projects load and we have a projectSlug, auto-select that project
  useEffect(() => {
    if (initialValues?.projectSlug && projects.length > 0) {
      const match = projects.find(p => p.slug === initialValues.projectSlug)
      if (match) setSelectedProjectId(match.id)
    }
  }, [projects, initialValues?.projectSlug])

  // Derived: selected project data
  const selectedProject = projects.find(p => p.id === selectedProjectId) ?? null
  const unitTypes = selectedProject?.unit_types ?? []

  // Bedroom groups
  const bedroomGroups = useMemo(() => {
    const map = new Map<number | null, ApiUnitType[]>()
    for (const ut of unitTypes) {
      const key = ut.bedrooms
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ut)
    }
    return map
  }, [unitTypes])

  const bedroomOptions = useMemo(() =>
    Array.from(bedroomGroups.keys()).sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      return a - b
    }), [bedroomGroups])

  const bedroomLabel = (b: number | null) => {
    if (b === 0) return 'Studio'
    if (b === null) return 'Commercial'
    return `${b} Bed`
  }

  // Units for selected bedroom group
  const bedroomUnits = selectedBedrooms !== 'unset'
    ? (bedroomGroups.get(selectedBedrooms as number | null) ?? [])
    : []

  function handleSelectBedrooms(b: number | null) {
    setSelectedBedrooms(b)
    setSelectedTypology(null)
    const units = bedroomGroups.get(b) ?? []
    if (units.length === 1) {
      // Only one unit type for this bedroom count — treat it like a typology selection
      const ut = units[0]
      setSelectedTypology(ut.typology)
      c.setPrice(ut.price_from)
      c.setInternalSqft(ut.size_sqft_from)
      if (selectedProject) c.setProject(selectedProject.name)
    }
  }

  function handleSelectTypology(ut: ApiUnitType) {
    setSelectedTypology(ut.typology)
    c.setPrice(ut.price_from)
    c.setInternalSqft(ut.size_sqft_from)
    if (selectedProject) c.setProject(selectedProject.name)
  }

  function handleSelectDeveloper(id: string) {
    if (id === '__add__') { setShowAddDev(true); return }
    setSelectedDeveloperId(id)
    setSelectedProjectId('')
    setSelectedBedrooms('unset')
    setSelectedTypology(null)
    const dev = developers.find(d => d.id === id)
    if (dev) {
      c.setDeveloper(dev.name)
      c.setDeveloperId(dev.id)
      c.setDeveloperTier(dev.tier ?? null)
    }
  }

  function handleSelectProject(id: string) {
    setSelectedProjectId(id)
    setSelectedBedrooms('unset')
    setSelectedTypology(null)
    const proj = projects.find(p => p.id === id)
    if (proj) {
      c.setProject(proj.name)
      c.setProjectSlug(proj.slug)
    }
  }

  // Restore bedroom/typology selection UI state once projects have loaded.
  // Calculator values (price, sqft) are already restored from initialValues by useCalculator.
  // This effect only syncs the selection chips/cards — it does NOT modify calculator state,
  // so it cannot trigger false dirty-state detection.
  const restoredSelectionRef = useRef(false)
  useEffect(() => {
    if (restoredSelectionRef.current) return
    if (!selectedProjectId || bedroomOptions.length === 0) return
    if (initialValues?.bedrooms === undefined && !initialValues?.typology) return

    restoredSelectionRef.current = true

    if (initialValues.bedrooms !== undefined) setSelectedBedrooms(initialValues.bedrooms)
    if (initialValues.typology != null)       setSelectedTypology(initialValues.typology)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId, bedroomOptions.length])

  // ── Dirty tracking ────────────────────────────────────────────────────────
  // Computes a compact key from the user-editable fields we care about.
  // Computed once from initialValues → cleanHash (the "saved" baseline).
  // Recomputed each render from current state → currentDirtyKey.
  // isDirty = they differ.

  function makeDirtyKey(
    price: number, rent: number, growth: number, handoverValue: number,
    propertyType: string, propertySubType: string,
    internalSqft: number, balconySqft: number, buaSqft: number, plotSqft: number, scRate: number,
    mortgageOn: boolean, depositPct: number, interestRate: number, termYears: number, mortgageType: string,
    beds: number | null | 'unset', typo: string | null
  ) {
    return [price, rent, growth, handoverValue, propertyType, propertySubType,
      internalSqft, balconySqft, buaSqft, plotSqft, scRate,
      mortgageOn, depositPct, interestRate, termYears, mortgageType,
      String(beds), typo].join('|')
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialDirtyKey = useMemo(() => makeDirtyKey(
    initialValues?.price ?? 0, initialValues?.rent ?? 0,
    initialValues?.growth ?? 5, initialValues?.handoverValue ?? 0,
    initialValues?.propertyType ?? 'offplan', initialValues?.propertySubType ?? 'apartment',
    initialValues?.internalSqft ?? 0, initialValues?.balconySqft ?? 0,
    initialValues?.buaSqft ?? 0, initialValues?.plotSqft ?? 0, initialValues?.scRate ?? 0,
    initialValues?.mortgageOn ?? false, initialValues?.depositPct ?? 25,
    initialValues?.interestRate ?? 4.0, initialValues?.termYears ?? 25,
    initialValues?.mortgageType ?? 'repayment',
    initialValues?.bedrooms !== undefined ? initialValues.bedrooms : 'unset',
    initialValues?.typology ?? null,
  ), []) // intentionally empty — snapshot at mount time only

  const currentDirtyKey = makeDirtyKey(
    c.price, c.rent, c.growth, c.handoverValue,
    c.propertyType, c.propertySubType,
    c.internalSqft, c.balconySqft, c.buaSqft, c.plotSqft, c.scRate,
    c.mortgageOn, c.depositPct, c.interestRate, c.termYears, c.mortgageType,
    selectedBedrooms, selectedTypology
  )

  // cleanHash tracks the last-saved state (starts as initialDirtyKey).
  // After a successful save we update it so "Unsaved" only reappears on further changes.
  const [cleanHash, setCleanHash] = useState(initialDirtyKey)
  // Ref so save handlers can read the current dirty key without stale closures
  const currentDirtyKeyRef = useRef(currentDirtyKey)
  currentDirtyKeyRef.current = currentDirtyKey

  const isDirty = currentDirtyKey !== cleanHash

  // Save flow
  const defaultDealName = [c.project, c.unit].filter(Boolean).join(' ') || editingDealName || 'Unnamed Deal'

  function buildDealBody(name: string) {
    const params = {
      ...c.toDealParams(),
      ...(selectedBedrooms !== 'unset' ? { bedrooms: selectedBedrooms } : {}),
      ...(selectedTypology  ? { typology: selectedTypology }  : {}),
    }
    const metrics = c.metrics
    return {
      name,
      params,
      calculatedMetrics: metrics ? {
        netYield: metrics.netYield,
        grossYield: metrics.grossYield,
        irr: metrics.irr,
        totalReturnY5: metrics.totalReturnY5,
        score: metrics.score,
        grade: metrics.grade,
      } : null,
    }
  }

  async function handleSave(name: string) {
    setSaving(true)
    try {
      const body = buildDealBody(name)

      // Editing an existing deal → PUT in place, no new ID needed
      const currentDealId = savedDealId ?? editingDealId
      if (currentDealId) {
        const res = await fetch(`/api/user/deals/${currentDealId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const d = await res.json() as { error?: string }; console.error(d.error); return }
        setShowSaveModal(false)
        setSaved(true)
        setCleanHash(currentDirtyKeyRef.current)
        setSavedDealId(currentDealId)
        setSavedDealName(name)
        if (!compact) router.replace(`/deals/${currentDealId}`)
        return
      }

      // New deal — check for name collision first
      const indexRes = await fetch('/api/user/deals')
      const index = indexRes.ok
        ? await indexRes.json() as { id: string; name: string }[]
        : []

      // Find any existing deal with the same name (case-insensitive)
      const match = index.find(
        d => d.name.toLowerCase() === name.toLowerCase()
      )
      if (match) {
        setShowSaveModal(false)
        setDupModal({ existingId: match.id, existingName: match.name, body })
        return
      }

      await doSaveNew(body)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function doSaveNew(body: object & { name?: string }) {
    const res = await fetch('/api/user/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { id?: string; error?: string }
    if (!res.ok) { console.error(data.error); return }
    setShowSaveModal(false)
    setDupModal(null)
    setSaved(true)
    setCleanHash(currentDirtyKeyRef.current)
    const newId = data.id!
    setSavedDealId(newId)
    setSavedDealName((body as { name?: string }).name ?? null)
    // Update URL without navigation — compact mode stays on project page
    if (!compact) {
      router.replace(`/deals/${newId}`)
    }
  }

  async function handleOverwrite() {
    if (!dupModal) return
    setSaving(true)
    try {
      const res = await fetch(`/api/user/deals/${dupModal.existingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dupModal.body),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) { console.error(data.error); return }
      const overwriteId = dupModal.existingId
      const overwriteName = dupModal.existingName
      setDupModal(null)
      setSaved(true)
      setCleanHash(currentDirtyKeyRef.current)
      setSavedDealId(overwriteId)
      setSavedDealName(overwriteName)
      if (!compact) {
        router.replace(`/deals/${overwriteId}`)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAsNew() {
    if (!dupModal) return
    setSaving(true)
    try {
      await doSaveNew(dupModal.body)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // ── Share handler ──────────────────────────────────────────────────────────
  async function handleShare() {
    setSharing(true)
    setShareUrl(null)
    try {
      const params = {
        ...c.toDealParams(),
        ...(selectedBedrooms !== 'unset' ? { bedrooms: selectedBedrooms } : {}),
        ...(selectedTypology  ? { typology: selectedTypology }  : {}),
      }
      const slug = c.projectSlug
      const res = await fetch(`/api/projects/${slug}/insight/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      })
      const data = await res.json() as { id?: string; url?: string; error?: string }
      if (!res.ok) { console.error(data.error); return }
      setShareUrl(data.url ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setSharing(false)
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  // ── Save as default ──────────────────────────────────────────────────────────
  async function handleSaveDefault() {
    setSavingDefault(true)
    try {
      const params = {
        ...c.toDealParams(),
        ...(selectedBedrooms !== 'unset' ? { bedrooms: selectedBedrooms } : {}),
        ...(selectedTypology  ? { typology: selectedTypology }  : {}),
      }
      const res = await fetch(`/api/projects/${c.projectSlug}/insight/defaults`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      })
      if (!res.ok) { console.error('Failed to save default'); return }
      setDefaultSaved(true)
      setTimeout(() => setDefaultSaved(false), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingDefault(false)
    }
  }

  // ── Load deal ────────────────────────────────────────────────────────────────
  async function handleOpenLoadModal() {
    setShowLoadModal(true)
    if (loadableDeals.length > 0) return  // already fetched
    setLoadingDeals(true)
    try {
      const res = await fetch(`/api/user/deals?projectSlug=${encodeURIComponent(c.projectSlug)}`)
      if (!res.ok) { console.error('Failed to fetch deals'); return }
      setLoadableDeals(await res.json() as LoadableDeal[])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDeals(false)
    }
  }

  function handleLoadDeal(deal: LoadableDeal) {
    const p = deal.params
    // Core financials
    if (p.price        != null) c.setPrice(p.price               as number)
    if (p.rent         != null) c.setRent(p.rent                 as number)
    if (p.growth       != null) c.setGrowth(p.growth             as number)
    if (p.handoverValue != null) c.setHandoverValue(p.handoverValue as number)
    // Property
    if (p.propertySubType) c.setPropertySubType(p.propertySubType as 'apartment' | 'townhouse' | 'villa')
    if (p.internalSqft != null) c.setInternalSqft(p.internalSqft as number)
    if (p.balconySqft  != null) c.setBalconySqft(p.balconySqft   as number)
    if (p.buaSqft      != null) c.setBuaSqft(p.buaSqft           as number)
    if (p.plotSqft     != null) c.setPlotSqft(p.plotSqft         as number)
    if (p.serviceCharge != null) { c.setScRate(p.serviceCharge as number); c.setScInput(String(p.serviceCharge)) }
    // Details
    if (p.completion) c.setCompletion(p.completion as string)
    if (p.view)       c.setView(p.view             as string)
    if (p.unit)       c.setUnit(p.unit             as string)
    if (p.emirate)    c.setEmirate(p.emirate        as 'Dubai' | 'Abu Dhabi')
    if (p.location)   c.setLocation(p.location      as string)
    // Acquisition costs
    if (p.dld        != null) { c.setDldPct(p.dld            as number); c.setDldInput(String(p.dld)) }
    if (p.agencyFee  != null) { c.setAgencyFeePct(p.agencyFee as number); c.setAgencyFeeInput(String(p.agencyFee)) }
    if (p.adminFee   != null) { c.setAdminFee(p.adminFee      as number); c.setAdminFeeInput(String(p.adminFee)) }
    // Mortgage
    if (p.mortgageOn   != null) c.setMortgageOn(p.mortgageOn     as boolean)
    if (p.depositPct   != null) c.setDepositPct(p.depositPct     as number)
    if (p.interestRate != null) c.setInterestRate(p.interestRate  as number)
    if (p.termYears    != null) c.setTermYears(p.termYears        as number)
    if (p.mortgageType) c.setMortgageType(p.mortgageType          as 'repayment' | 'interest-only')
    // Payment plan
    try { c.setPaymentPlan(JSON.parse((p.paymentPlan as string) ?? '[]')) } catch { /* ignore */ }
    // Bedrooms / typology (local DealBuilder state)
    setSelectedBedrooms(p.bedrooms !== undefined ? (p.bedrooms as number | null) : 'unset')
    setSelectedTypology((p.typology as string | null) ?? null)

    setShowLoadModal(false)
  }

  const { metrics: m } = c

  // ── Render ──────────────────────────────────────────────────────────────────

  const TABS: TabName[] = ['Overview', 'Returns', 'Growth', 'Financing']

  return (
    <div className={compact ? 'bg-[#fafafa]' : 'bg-[#fafafa] min-h-screen pb-20'}>

      {/* Page header — hidden in compact (embedded) mode */}
      {!compact && (
        <div className="bg-[#18181b] border-b border-[#27272a]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-white">{editingDealId ? 'Edit Deal' : 'New Deal'}</h1>
              <p className="text-sm text-zinc-400 mt-0.5">Build and analyse your investment</p>
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
            >
              Save deal
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Zone 1: Project Selector — hidden in compact/embedded mode ── */}
        {!compact && (!manualMode ? (
          <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Select a project</h2>
              <button
                onClick={() => setManualMode(true)}
                className="text-xs text-[#71717a] hover:text-gray-900 underline underline-offset-2"
              >
                No project? Enter manually
              </button>
            </div>

            {/* Developer dropdown */}
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {lockDeveloper && c.developer ? (
                <div>
                  <label className="block text-xs font-medium text-[#71717a] mb-1.5">Developer</label>
                  <div className="flex items-center gap-2 border border-[#e4e4e7] rounded-xl px-3 py-2 bg-gray-50">
                    <svg className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span className="text-sm text-gray-700">{c.developer}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-[#71717a] mb-1.5">Developer</label>
                  <select
                    value={selectedDeveloperId}
                    onChange={e => handleSelectDeveloper(e.target.value)}
                    className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#18181b] appearance-none"
                  >
                    <option value="">Select developer…</option>
                    {developers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                    <option value="__add__">+ Add new developer</option>
                  </select>
                </div>
              )}

              {/* Project dropdown */}
              {selectedDeveloperId && (
                lockProject && c.project ? (
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Project</label>
                    <div className="flex items-center gap-2 border border-[#e4e4e7] rounded-xl px-3 py-2 bg-gray-50">
                      <svg className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-sm text-gray-700">{c.project}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={e => handleSelectProject(e.target.value)}
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#18181b] appearance-none"
                    >
                      <option value="">Select project…</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )
              )}
            </div>

            {/* Bedroom chips */}
            {selectedProjectId && bedroomOptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#71717a] mb-2">Bedrooms</p>
                <div className="flex flex-wrap gap-2">
                  {bedroomOptions.map(b => (
                    <button
                      key={String(b)}
                      onClick={() => handleSelectBedrooms(b)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        selectedBedrooms === b
                          ? 'bg-[#18181b] text-white border-[#18181b]'
                          : 'text-[#71717a] border-[#e4e4e7] hover:bg-[#e4e4e7]'
                      }`}
                    >
                      {bedroomLabel(b)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typology cards */}
            {selectedBedrooms !== 'unset' && bedroomUnits.length > 1 && (
              <div>
                <p className="text-xs font-medium text-[#71717a] mb-2">Unit type</p>
                <div className="flex flex-wrap gap-2">
                  {bedroomUnits.map(ut => (
                    <button
                      key={ut.id}
                      onClick={() => handleSelectTypology(ut)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        selectedTypology === ut.typology
                          ? 'bg-[#18181b] text-white border-[#18181b]'
                          : 'text-[#71717a] border-[#e4e4e7] hover:bg-[#e4e4e7]'
                      }`}
                    >
                      {ut.typology ?? ut.type}
                      <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                        from AED {fmtK(ut.price_from)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#e4e4e7] p-4 flex items-center justify-between">
            <p className="text-sm text-[#71717a]">Manual entry mode</p>
            <button
              onClick={() => setManualMode(false)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2"
            >
              Select a project
            </button>
          </div>
        ))}

        {/* ── Zone 0b: Project selector — compact/embedded mode ── */}
        {compact && (
          <div className="bg-white rounded-2xl border border-[#e4e4e7] p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Developer — locked */}
              <div>
                <label className="block text-xs font-medium text-[#71717a] mb-1.5">Developer</label>
                <div className="flex items-center gap-2 border border-[#e4e4e7] rounded-xl px-3 py-2 bg-gray-50">
                  <svg className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-gray-700">{c.developer || '—'}</span>
                </div>
              </div>
              {/* Project — locked */}
              <div>
                <label className="block text-xs font-medium text-[#71717a] mb-1.5">Project</label>
                <div className="flex items-center gap-2 border border-[#e4e4e7] rounded-xl px-3 py-2 bg-gray-50">
                  <svg className="w-3.5 h-3.5 text-[#a1a1aa] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-gray-700">{c.project || '—'}</span>
                </div>
              </div>
            </div>

            {/* Bedrooms */}
            {bedroomOptions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#71717a] mb-2">Bedrooms</p>
                <div className="flex flex-wrap gap-2">
                  {bedroomOptions.map(b => (
                    <button
                      key={String(b)}
                      onClick={() => handleSelectBedrooms(b)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        selectedBedrooms === b
                          ? 'bg-[#18181b] text-white border-[#18181b]'
                          : 'text-[#71717a] border-[#e4e4e7] hover:bg-[#e4e4e7]'
                      }`}
                    >
                      {bedroomLabel(b)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Typology */}
            {selectedBedrooms !== 'unset' && bedroomUnits.length > 1 && (
              <div>
                <p className="text-xs font-medium text-[#71717a] mb-2">Unit type</p>
                <div className="flex flex-wrap gap-2">
                  {bedroomUnits.map(ut => (
                    <button
                      key={ut.id}
                      onClick={() => handleSelectTypology(ut)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                        selectedTypology === ut.typology
                          ? 'bg-[#18181b] text-white border-[#18181b]'
                          : 'text-[#71717a] border-[#e4e4e7] hover:bg-[#e4e4e7]'
                      }`}
                    >
                      {ut.typology ?? ut.type}
                      <span className="block text-[10px] font-normal mt-0.5 opacity-70">
                        from AED {fmtK(ut.price_from)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Zone 2: Two-column grid — hidden in compact when inputs collapsed ── */}
        {/* Always two-column on lg+: inputs left, dark summary sticky right.         */}
        {/* Mobile compact: stacks naturally (single column).                         */}
        {(!compact || assumptionsOpen) && (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* Left column — input cards */}
          <div className="space-y-4">

            {/* PropertyCard */}
            <Card>
              <CardHeader title="Property" />
              <div className="px-5 pb-5 pt-4 space-y-4">
                <PillGroup
                  options={[
                    { label: 'Off-plan', value: 'offplan' },
                    { label: 'Secondary', value: 'secondary' },
                  ]}
                  value={c.propertyType}
                  onChange={c.setPropertyType}
                />
                <PillGroup
                  options={[
                    { label: 'Apartment', value: 'apartment' },
                    { label: 'Townhouse', value: 'townhouse' },
                    { label: 'Villa', value: 'villa' },
                  ]}
                  value={c.propertySubType}
                  onChange={c.setPropertySubType}
                />

                <NumberInput
                  label="Price (AED)"
                  value={c.price}
                  onChange={c.setPrice}
                  prefix="AED "
                  placeholder="e.g. 1,500,000"
                />

                {c.isApartment ? (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="Internal sqft" value={c.internalSqft} onChange={c.setInternalSqft} suffix=" ft²" placeholder="0" />
                    <NumberInput label="Balcony sqft" value={c.balconySqft} onChange={c.setBalconySqft} suffix=" ft²" placeholder="0" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="BUA sqft" value={c.buaSqft} onChange={c.setBuaSqft} suffix=" ft²" placeholder="0" />
                    <NumberInput label="Plot sqft (optional)" value={c.plotSqft} onChange={c.setPlotSqft} suffix=" ft²" placeholder="0" />
                  </div>
                )}

                {c.propertyType === 'offplan' && (
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Completion date (MM/YYYY)</label>
                    <input
                      type="text"
                      value={c.completion}
                      onChange={e => c.setCompletion(e.target.value)}
                      placeholder="e.g. 06/2027"
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                    />
                    {c.completion && !c.completionValid && (
                      <p className="text-[10px] text-red-500 mt-1">Use MM/YYYY format (e.g. 06/2027)</p>
                    )}
                  </div>
                )}

                <NumberInput
                  label="Service charge (AED/sqft/yr)"
                  value={c.scRate}
                  onChange={v => { c.setScRate(v); c.setScInput(String(v)) }}
                  placeholder="0"
                  hint={c.bua > 0 && c.scRate > 0 ? `≈ AED ${fmt(c.scRate * c.bua)} / yr total` : undefined}
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Unit / Floor</label>
                    <input value={c.unit} onChange={e => c.setUnit(e.target.value)} placeholder="e.g. 2104"
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">View</label>
                    <input value={c.view} onChange={e => c.setView(e.target.value)} placeholder="e.g. Sea view"
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Location / Area</label>
                    <input value={c.location} onChange={e => c.setLocation(e.target.value)} placeholder="e.g. Dubai Marina"
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#71717a] mb-1.5">Emirate</label>
                    <select value={c.emirate} onChange={e => c.setEmirate(e.target.value as 'Dubai' | 'Abu Dhabi')}
                      className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#18181b] appearance-none">
                      <option value="Dubai">Dubai</option>
                      <option value="Abu Dhabi">Abu Dhabi</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>

            {/* AssumptionsCard */}
            <Card>
              <CardHeader title="Assumptions" />
              <div className="px-5 pb-5 pt-4 space-y-5">
                {/* Rent */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 font-medium">Annual rent</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={c.rent > 0 ? `AED ${fmt(c.rent)}` : ''}
                      onFocus={e => { e.target.value = c.rent > 0 ? String(c.rent) : '' }}
                      onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); if (!isNaN(v)) c.setRent(v) }}
                      onBlur={() => {}}
                      placeholder="AED"
                      className="w-36 border border-[#e4e4e7] rounded-xl px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#18181b]"
                    />
                  </div>
                  {c.price > 0 && (
                    <input type="range"
                      min={Math.max(30000, Math.floor(c.price * 0.02 / 5000) * 5000)}
                      max={Math.ceil(c.price * 0.12 / 5000) * 5000 || 500000}
                      step={5000}
                      value={c.rent}
                      onChange={e => c.setRent(Number(e.target.value))}
                      className="w-full accent-emerald-500" />
                  )}
                </div>

                {/* Capital growth */}
                <RangeSlider label="Capital growth %/yr" value={c.growth} min={0} max={15} step={0.5}
                  display={fmtPct(c.growth)} onChange={c.setGrowth} />

                {/* Handover value (offplan only) */}
                {c.propertyType === 'offplan' && (
                  <HandoverSlider
                    value={c.handoverValue}
                    min={c.price > 0 ? Math.floor(c.price * 0.85 / 100000) * 100000 : 0}
                    max={c.price > 0 ? Math.ceil(c.price * 1.6 / 100000) * 100000 : 5000000}
                    step={50000}
                    onChange={c.setHandoverValue}
                  />
                )}
              </div>
            </Card>

            {/* FinancingCard */}
            <Card>
              <CardHeader title="Financing" />
              <div className="px-5 pb-5 pt-4 space-y-4">
                <PillGroup
                  options={[
                    { label: 'Cash', value: 'false' },
                    { label: 'Mortgage', value: 'true' },
                  ]}
                  value={c.mortgageOn ? 'true' : 'false'}
                  onChange={v => c.setMortgageOn(v === 'true')}
                />

                {c.mortgageOn && (
                  <div className="space-y-4">
                    <RangeSlider label="Deposit %" value={c.depositPct} min={10} max={80} step={5}
                      display={`${c.depositPct}% (AED ${fmtK(c.price * c.depositPct / 100)})`}
                      onChange={c.setDepositPct} />
                    <RangeSlider label="Interest rate %" value={c.interestRate} min={2} max={10} step={0.1}
                      display={`${c.interestRate.toFixed(1)}%`} onChange={c.setInterestRate} />
                    <div>
                      <p className="text-xs font-medium text-[#71717a] mb-2">Term</p>
                      <div className="flex gap-1">
                        {[10, 15, 20, 25, 30].map(y => (
                          <button key={y} onClick={() => c.setTermYears(y)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              c.termYears === y
                                ? 'bg-[#18181b] text-white border-[#18181b]'
                                : 'text-[#71717a] border-[#e4e4e7] hover:bg-[#e4e4e7]'
                            }`}>
                            {y}yr
                          </button>
                        ))}
                      </div>
                    </div>
                    <PillGroup
                      options={[
                        { label: 'Repayment', value: 'repayment' },
                        { label: 'Interest only', value: 'interest-only' },
                      ]}
                      value={c.mortgageType}
                      onChange={c.setMortgageType}
                    />
                  </div>
                )}

                {/* Acquisition costs */}
                <div className="border-t border-gray-100 pt-3">
                  <button
                    onClick={() => setShowAcqCosts(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-[#71717a] hover:text-gray-900"
                  >
                    <svg className={`w-3 h-3 transition-transform ${showAcqCosts ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Acquisition costs
                  </button>
                  {showAcqCosts && (
                    <div className="mt-3 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-[#71717a] mb-1.5">DLD %</label>
                          <input type="text" inputMode="decimal" value={c.dldInput}
                            onChange={e => { c.setDldInput(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) c.setDldPct(v) }}
                            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#71717a] mb-1.5">Agency fee %</label>
                          <input type="text" inputMode="decimal" value={c.agencyFeeInput}
                            onChange={e => { c.setAgencyFeeInput(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v)) c.setAgencyFeePct(v) }}
                            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#71717a] mb-1.5">Admin fee AED</label>
                          <input type="text" inputMode="numeric" value={c.adminFeeInput}
                            onChange={e => { c.setAdminFeeInput(e.target.value); const v = parseInt(e.target.value.replace(/[^0-9]/g, '')); if (!isNaN(v)) c.setAdminFee(v) }}
                            className="w-full border border-[#e4e4e7] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* PaymentPlanCard (offplan only) */}
            {c.propertyType === 'offplan' && (
              <Card>
                <CardHeader title="Payment plan" />
                <div className="px-5 pb-5 pt-4">
                  {c.paymentPlan.length > 0 && (
                    <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
                      {c.paymentPlan.map((row, i) => (
                        <div key={row.id}
                          style={{ width: `${row.pct}%`, backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                          title={`${row.label}: ${row.pct}%`} />
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    {c.paymentPlan.map((row, i) => (
                      <div key={row.id} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }} />
                        <input
                          type="text"
                          value={row.label}
                          onChange={e => c.updatePlanRow(row.id, 'label', e.target.value)}
                          placeholder="Label"
                          className="flex-1 min-w-0 border border-[#e4e4e7] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#18181b]"
                        />
                        <input
                          type="text"
                          value={row.date}
                          onChange={e => c.updatePlanRow(row.id, 'date', e.target.value)}
                          placeholder="Date"
                          className="w-28 border border-[#e4e4e7] rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#18181b]"
                        />
                        <input
                          type="number"
                          value={row.pct || ''}
                          onChange={e => c.updatePlanRow(row.id, 'pct', Number(e.target.value))}
                          placeholder="%"
                          min={0} max={100}
                          className="w-14 border border-[#e4e4e7] rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-[#18181b]"
                        />
                        <span className="text-xs text-[#71717a] w-20 tabular-nums flex-shrink-0">
                          AED {c.price > 0 ? fmtK(c.price * row.pct / 100) : '0'}
                        </span>
                        <button
                          onClick={() => c.toggleHandover(row.id)}
                          title="Mark as handover"
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border flex-shrink-0 ${
                            row.handover
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'text-[#a1a1aa] border-[#e4e4e7] hover:border-[#a1a1aa]'
                          }`}
                        >
                          HO
                        </button>
                        <button
                          onClick={() => c.removePlanRow(row.id)}
                          className="text-[#a1a1aa] hover:text-red-500 flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <button onClick={c.addPlanRow}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add row
                    </button>
                    {c.paymentPlan.length > 0 && (
                      <span className={`text-xs font-semibold tabular-nums ${c.planComplete ? 'text-emerald-600' : 'text-red-500'}`}>
                        {c.planTotal.toFixed(1)}% {c.planComplete ? '✓' : '(must be 100%)'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right column — dark summary panel, sticky on desktop */}
          <div className={`lg:sticky ${stickyTop}`}>
            <div className="bg-[#18181b] rounded-2xl p-6 space-y-4">
              {/* Header */}
              <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-0.5">
                  {[c.project, selectedTypology ? `· ${selectedTypology}` : ''].filter(Boolean).join(' ') || 'Unnamed deal'}
                </p>
                <p className="text-white text-2xl font-bold">
                  {c.price > 0 ? `AED ${fmtK(c.price)}` : '—'}
                </p>
              </div>

              {/* Key metrics */}
              <div className="border-t border-zinc-700 pt-4 space-y-2">
                {[
                  { label: 'Net yield', value: m ? fmtPct(m.netYield) : '—' },
                  { label: 'IRR (5yr)', value: m?.irr !== undefined && m.irr !== null ? fmtPct(m.irr) : '—' },
                  { label: 'Total return', value: m ? `AED ${fmtK(m.totalReturnY5)}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-baseline">
                    <span className="text-zinc-400 text-sm">{label}</span>
                    <span className="text-white text-sm font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>

              {/* Score bar */}
              {m && (
                <div className="border-t border-zinc-700 pt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-white">{m.grade}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-semibold">{m.score} / 100</p>
                      <p className="text-zinc-500 text-xs">{GRADE_VERDICT[m.grade]}</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${m.score}%` }} />
                  </div>
                </div>
              )}

              {/* Save button */}
              <div className="border-t border-zinc-700 pt-4 space-y-2">
                {/* Badge: show "Name ✓" when clean+saved, "Unsaved" when dirty, nothing otherwise */}
                {isDirty ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                    Unsaved
                  </span>
                ) : saved ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                    {savedDealName ?? 'Saved'} ✓
                  </span>
                ) : null}
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
                >
                  Save deal
                </button>
              </div>

              {/* Admin controls — insight page only */}
              {(showShare || showSaveDefault || showLoad) && (
                <div className="border-t border-zinc-700 pt-4 space-y-2">

                  {/* Save as default */}
                  {showSaveDefault && (
                    <button
                      onClick={handleSaveDefault}
                      disabled={savingDefault}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-white transition-colors"
                    >
                      {savingDefault ? 'Saving…' : defaultSaved ? 'Saved as default ✓' : 'Save as default'}
                    </button>
                  )}

                  {/* Load deal */}
                  {showLoad && (
                    <button
                      onClick={handleOpenLoadModal}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
                    >
                      Load deal
                    </button>
                  )}

                  {/* Save & share */}
                  {showShare && (
                    <>
                      <button
                        onClick={handleShare}
                        disabled={sharing}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white transition-colors"
                      >
                        {sharing ? 'Saving…' : 'Save & share'}
                      </button>
                      {shareUrl && (
                        <div className="flex gap-1.5">
                          <input
                            readOnly
                            value={shareUrl}
                            className="flex-1 min-w-0 text-xs bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1.5 text-zinc-300 truncate focus:outline-none"
                          />
                          <button
                            onClick={copyShareUrl}
                            className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
                          >
                            {shareCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
        )}

        {/* Inputs toggle — compact mode; always visible, sits above the analysis tabs */}
        {compact && (
          <div className="flex items-center">
            <button
              onClick={() => setAssumptionsOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#71717a] hover:text-gray-900 transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${assumptionsOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {assumptionsOpen ? 'Hide inputs' : 'Show inputs'}
            </button>
          </div>
        )}

        {/* Analysis section heading — compact mode only; separates grid from tabs */}
        {compact && (
          <div className="border-t border-[#e4e4e7] pt-6">
            <p className="text-xs uppercase tracking-widest font-semibold text-[#a1a1aa] mb-4">Analysis</p>
          </div>
        )}

        {/* ── Zone 3: Analysis — accordion on mobile, tabs on desktop ── */}
        {m && (() => {
          const tabOverviewContent = (
            <TabOverview
              m={m}
              price={c.price}
              mortgageOn={c.mortgageOn}
              handoverValue={c.handoverValue}
              propertyType={c.propertyType}
              propertySubType={c.propertySubType}
              project={c.project}
              developer={c.developer}
              unit={c.unit}
              location={c.location}
              emirate={c.emirate}
              view={c.view}
              completion={c.completion}
              internalSqft={c.internalSqft}
              balconySqft={c.balconySqft}
              buaSqft={c.bua}
              plotSqft={c.plotSqft}
            />
          )
          const tabReturnsContent = (
            <TabReturns
              m={m}
              mortgageOn={c.mortgageOn}
              price={c.price}
              rent={c.rent}
              setRent={c.setRent}
              interestRate={c.interestRate}
              termYears={c.termYears}
            />
          )
          const tabGrowthContent = (
            <TabGrowth
              m={m}
              mortgageOn={c.mortgageOn}
              price={c.price}
              growth={c.growth}
              setGrowth={c.setGrowth}
              propertyType={c.propertyType}
              handoverValue={c.handoverValue}
              setHandoverValue={c.setHandoverValue}
              interestRate={c.interestRate}
              termYears={c.termYears}
              paymentPlan={c.paymentPlan}
              completion={c.completion}
            />
          )
          const tabFinancingContent = (
            <TabFinancing
              m={m}
              mortgageOn={c.mortgageOn}
              price={c.price}
              paymentPlan={c.paymentPlan}
              dldPct={c.dldPct}
              agencyFeePct={c.agencyFeePct}
              adminFee={c.adminFee}
              depositPct={c.depositPct}
              setDepositPct={c.setDepositPct}
              interestRate={c.interestRate}
              setInterestRate={c.setInterestRate}
              termYears={c.termYears}
            />
          )
          const TAB_CONTENT: Record<TabName, React.ReactNode> = {
            Overview: tabOverviewContent,
            Returns: tabReturnsContent,
            Growth: tabGrowthContent,
            Financing: tabFinancingContent,
          }
          return (
            <div>
              {/* Desktop: tabs (≥ sm) */}
              <div className="hidden sm:block">
                <div className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden mb-4">
                  <div className="flex border-b border-[#e4e4e7]">
                    {TABS.map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                          activeTab === tab
                            ? 'border-emerald-500 text-emerald-600'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}>
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div>{TAB_CONTENT[activeTab]}</div>
              </div>

              {/* Mobile: accordion (< sm) */}
              <div className="sm:hidden space-y-3">
                {TABS.map(tab => {
                  const isOpen = activeAccordion === tab
                  return (
                    <div key={tab} className="bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setActiveAccordion(isOpen ? null : tab)}
                        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900"
                      >
                        <span>{tab}</span>
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="border-t border-[#e4e4e7]">
                          {TAB_CONTENT[tab]}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {!m && (
          <div className="bg-white rounded-2xl border border-[#e4e4e7] p-8 text-center">
            <p className="text-sm text-[#71717a]">Enter a price and annual rent to see full analysis</p>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showAddDev && (
        <AddDeveloperModal
          onClose={() => setShowAddDev(false)}
          onCreated={dev => {
            setDevelopers(prev => [...prev, dev].sort((a, b) => a.name.localeCompare(b.name)))
            setSelectedDeveloperId(dev.id)
            c.setDeveloper(dev.name)
            c.setDeveloperId(dev.id)
            setShowAddDev(false)
          }}
        />
      )}

      {showSaveModal && (
        <SaveModal
          defaultName={defaultDealName}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {dupModal && (
        <DupModal
          existingName={dupModal.existingName}
          onOverwrite={handleOverwrite}
          onSaveAsNew={handleSaveAsNew}
          onCancel={() => setDupModal(null)}
          loading={saving}
        />
      )}

      {showLoadModal && (
        <LoadDealModal
          deals={loadableDeals}
          loading={loadingDeals}
          onClose={() => setShowLoadModal(false)}
          onLoad={handleLoadDeal}
        />
      )}
    </div>
  )
}
