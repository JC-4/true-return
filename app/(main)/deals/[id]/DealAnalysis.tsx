'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { computeDealMetrics, buildAndSolveIRR, PLAN_COLORS, type PlanRow, type DealMetrics, type ScoreBreakdown } from '@/lib/calculations'

// ─── Types ────────────────────────────────────────────────────────────────────

type DealParams = {
  propertyType?: string; propertySubType?: string
  price?: number; rent?: number; growth?: number
  internalSqft?: number; balconySqft?: number
  buaSqft?: number; plotSqft?: number
  view?: string; unit?: string; project?: string
  completion?: string; developer?: string
  serviceCharge?: number; dld?: number; agencyFee?: number; adminFee?: number
  handoverValue?: number; paymentPlan?: string
  mortgageOn?: boolean; depositPct?: number; interestRate?: number
  termYears?: number; mortgageType?: string
  emirate?: string; location?: string
  bedrooms?: number | null; typology?: string | null
}

export type StoredDeal = {
  id: string; name: string; savedAt: string; updatedAt?: string
  params: DealParams
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

function buildCalcUrl(p: DealParams): string {
  const q = new URLSearchParams()
  if (p.price)         q.set('price',         String(p.price))
  if (p.rent)          q.set('rent',           String(p.rent))
  if (p.growth !== undefined) q.set('growth',  String(p.growth))
  if (p.internalSqft)  q.set('internalSqft',   String(p.internalSqft))
  if (p.balconySqft)   q.set('balconySqft',    String(p.balconySqft))
  if (p.buaSqft)       q.set('buaSqft',        String(p.buaSqft))
  if (p.plotSqft)      q.set('plotSqft',       String(p.plotSqft))
  if (p.propertySubType && p.propertySubType !== 'apartment') q.set('propertySubType', p.propertySubType)
  if (p.view)          q.set('view',           p.view)
  if (p.unit)          q.set('unit',           p.unit)
  if (p.project)       q.set('project',        p.project)
  if (p.completion)    q.set('completion',     p.completion)
  if (p.developer)     q.set('developer',      p.developer)
  if (p.serviceCharge) q.set('serviceCharge',  String(p.serviceCharge))
  if (p.dld !== undefined && p.dld !== 4) q.set('dld', String(p.dld))
  if (p.agencyFee)     q.set('agencyFee',      String(p.agencyFee))
  if (p.adminFee)      q.set('adminFee',       String(p.adminFee))
  if (p.propertyType && p.propertyType !== 'offplan') q.set('propertyType', p.propertyType)
  if (p.handoverValue) q.set('handoverValue',  String(p.handoverValue))
  if (p.paymentPlan && p.paymentPlan !== '[]') q.set('paymentPlan', encodeURIComponent(p.paymentPlan))
  if (p.mortgageOn)    q.set('mortgageOn',     'true')
  if (p.depositPct !== undefined) q.set('depositPct', String(p.depositPct))
  if (p.interestRate !== undefined) q.set('interestRate', String(p.interestRate))
  if (p.termYears !== undefined) q.set('termYears', String(p.termYears))
  if (p.mortgageType && p.mortgageType !== 'repayment') q.set('mortgageType', p.mortgageType)
  if (p.emirate && p.emirate !== 'Dubai') q.set('emirate', p.emirate)
  if (p.location) q.set('location', p.location)
  return `/calculators/investment?${q.toString()}`
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

// Handover value slider with inline free-text input.
// Separate component so it can own the raw-input state without
// polluting the generic RangeSlider.
function HandoverSlider({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void
}) {
  const [raw,     setRaw]     = useState('')
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

function ExplorationNote() {
  return (
    <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
      Changes here are for exploration only — won&apos;t affect your saved deal.
    </p>
  )
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function ScoreBreakdownPanel({ score, grade, breakdown }: {
  score: number; grade: string; breakdown: ScoreBreakdown
}) {
  const rows = [
    {
      label: `Net yield`,
      sub: `${breakdown.yieldPts.toFixed(1)} / 35`,
      pts: breakdown.yieldPts,
      max: 35,
    },
    {
      label: `Unleveraged IRR${breakdown.scoringIrr !== null ? ` (${breakdown.scoringIrr.toFixed(1)}%)` : ''}`,
      sub: `${breakdown.irrPts.toFixed(1)} / 35`,
      pts: breakdown.irrPts,
      max: 35,
    },
    {
      label: 'Developer tier',
      sub: `${breakdown.devPts} / 20`,
      pts: breakdown.devPts,
      max: 20,
    },
    {
      label: breakdown.preCompletionROE !== null
        ? `Pre-completion ROE (${breakdown.preCompletionROE.toFixed(1)}%)`
        : 'Secondary / property type',
      sub: `${breakdown.roePts} / 10`,
      pts: breakdown.roePts,
      max: 10,
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

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function TabOverview({ deal, m, mortgageOn, handoverValue, price }: { deal: StoredDeal; m: DealMetrics; mortgageOn: boolean; handoverValue: number; price: number }) {
  const p = deal.params
  const [showBreakdown, setShowBreakdown] = useState(false)

  const propertySubType = (p.propertySubType ?? 'apartment') as 'apartment' | 'townhouse' | 'villa'
  const isApartment     = propertySubType === 'apartment'
  const internalSqft    = p.internalSqft ?? 0
  const balconySqft     = p.balconySqft  ?? 0
  const buaSqft         = p.buaSqft ?? (internalSqft + balconySqft)
  const plotSqft        = p.plotSqft ?? 0

  return (
    <div className="space-y-4">

      {/* Hero band */}
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
            { label: 'Purchase price',    value: `AED ${fmtK(p.price ?? 0)}`, mint: false },
            { label: 'Net yield',         value: (p.price ?? 0) > 0 ? fmtPct(m.netYield) : '—', mint: true },
            { label: 'IRR (5yr)',         value: m.irr !== null ? fmtPct(m.irr) : '—', mint: true },
            { label: 'Total return (5yr)', value: (p.price ?? 0) > 0 ? `AED ${fmtK(m.totalReturnY5)}` : '—', mint: true },
          ].map(({ label, value, mint }) => (
            <div key={label}>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-medium mb-1">{label}</p>
              <p className={`text-lg font-bold ${mint ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">

        {/* Property facts */}
        <Card>
          <CardHeader title="Property" />
          <div className="px-5 py-2">
            {[
              { label: 'Location',         value: p.location ? `${p.location}, ${p.emirate ?? 'Dubai'}` : '—' },
              { label: 'Developer',        value: p.developer || '—' },
              { label: 'Project',          value: p.project   || '—' },
              { label: 'Unit',             value: p.unit      || '—' },
              { label: 'Sale type',        value: p.propertyType === 'secondary' ? 'Secondary market' : 'Off-plan' },
              { label: 'Property subtype', value: propertySubType.charAt(0).toUpperCase() + propertySubType.slice(1) },
              ...(isApartment ? [
                { label: 'Internal sqft', value: internalSqft ? `${internalSqft.toLocaleString()} ft²` : '—' },
                { label: 'Balcony sqft',  value: balconySqft  ? `${balconySqft.toLocaleString()} ft²`  : '—' },
                { label: 'BUA',           value: buaSqft      ? `${buaSqft.toLocaleString()} ft²`      : '—' },
              ] : [
                { label: 'BUA',           value: buaSqft  ? `${buaSqft.toLocaleString()} ft²`  : '—' },
                { label: 'Plot size',     value: plotSqft ? `${plotSqft.toLocaleString()} ft²` : '—' },
              ]),
              { label: 'View',             value: p.view      || '—' },
              { label: 'Completion',       value: p.completion || '—' },
              { label: 'Price per sqft',   value: m.pricePerSqft > 0 ? `AED ${fmt(m.pricePerSqft)}` : '—' },
            ].map(r => <StatRow key={r.label} label={r.label} value={r.value} />)}
          </div>
        </Card>

        <div className="space-y-4">
          {/* Top numbers */}
          <Card>
            <CardHeader title="Key numbers" />
            <div className="px-5 py-2">
              <StatRow label="Net yield"           value={(p.price ?? 0) > 0 ? fmtPct(m.netYield) : '—'} mint />
              <StatRow label="Annual cashflow"     value={(p.price ?? 0) > 0 ? `AED ${fmt(m.annualCashflow)}` : '—'} mint />
              <StatRow label="Total 5yr return"    value={(p.price ?? 0) > 0 ? `AED ${fmt(m.totalReturnY5)}` : '—'} mint />
              {handoverValue > 0 && (
                <div className="flex justify-between items-start py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-500">Est. value at handover</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">AED {fmt(handoverValue)}</span>
                    <p className="text-xs text-gray-400 mt-0.5">+AED {fmt(handoverValue - price)} vs purchase price</p>
                  </div>
                </div>
              )}
              <StatRow label="IRR (5yr exit)"      value={m.irr !== null ? fmtPct(m.irr) : '—'} mint />
            </div>
          </Card>

          {/* Investment score */}
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

// ─── ROE card (mortgage only) ─────────────────────────────────────────────────

function RoeCard({ m, price, rent, rentGrowth, interestRate, termYears }: {
  m: DealMetrics; price: number
  rent: number; rentGrowth: number
  interestRate: number; termYears: number
}) {
  const [hovered, setHovered] = useState(false)
  if (m.loanAmount <= 0 || m.upfrontCash <= 0) return null

  const equityDeployed = m.upfrontCash           // deposit + acquisition costs
  const mr  = interestRate / 100 / 12            // monthly interest rate
  const mp  = m.monthlyPayment
  const n   = termYears * 12

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
    const cf    = cashflowInYear(y)
    const pr    = principalInYear(y)
    const total = cf + pr
    const roe   = equityDeployed > 0 ? (total / equityDeployed) * 100 : 0
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
          {/* Shared denominator */}
          <div className="flex justify-between items-baseline px-3 py-2 border-b border-gray-100">
            <span className="text-xs text-gray-500">Equity deployed</span>
            <span className="text-xs font-semibold text-gray-800 tabular-nums">AED {fmt(equityDeployed)}</span>
          </div>
          {/* Year sections */}
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
              <div className="flex justify-between items-baseline px-3 py-1">
                <span className="text-xs text-gray-500">Total return on equity</span>
                <span className={`text-xs font-semibold tabular-nums ${s.total < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                  AED {fmt(s.total)}
                </span>
              </div>
              <div className="flex justify-between items-baseline px-3 pt-1 pb-2">
                <span className="text-xs text-gray-500">ROE</span>
                <span className="text-xs font-semibold text-emerald-600 tabular-nums">{fmtPct(s.roe)}</span>
              </div>
            </div>
          ))}
          {/* Formula */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-mono leading-snug">(cashflow + principal repaid) ÷ equity deployed</p>
            <p className="text-[10px] text-gray-300 mt-1 leading-snug">ROE improves each year as principal repayment increases</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: Returns ───────────────────────────────────────────────────────────

function TabReturns({
  m, mortgageOn, price, rent, setRent, savedRent, rentGrowth, setRentGrowth,
  interestRate, termYears,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number
  rent: number; setRent: (v: number) => void; savedRent: number
  rentGrowth: number; setRentGrowth: (v: number) => void
  interestRate: number; termYears: number
}) {
  const rentMin = Math.floor(savedRent * 0.5 / 5000) * 5000
  const rentMax = Math.ceil(savedRent * 1.5 / 5000) * 5000 || 300000

  // Year-by-year cashflow with compounding rent growth (Years 1–5)
  let cumulative = 0
  const yrRows = [1, 2, 3, 4, 5].map(y => {
    const yearRent = rent * Math.pow(1 + rentGrowth / 100, y - 1)
    const netCf = yearRent - m.serviceCharge - (mortgageOn ? m.annualMortgageCost : 0)
    cumulative += netCf
    return { year: y, grossRent: yearRent, sc: m.serviceCharge, netCf, cumulative }
  })

  const breakEvenRent = m.serviceCharge + (mortgageOn ? m.annualMortgageCost : 0)

  // CalcCard rows
  const netYieldRows: CalcRow[] = [
    { label: 'Annual rent',       value: `AED ${fmt(m.grossRent)}` },
    { label: 'Service charge (−)', value: `−AED ${fmt(m.serviceCharge)}`, negative: true },
    { label: 'Net annual income', value: `AED ${fmt(m.netIncome)}` },
    { label: 'Purchase price',    value: `AED ${fmt(price)}` },
    { label: 'Net yield',         value: price > 0 ? fmtPct(m.netYield) : '—', isFinal: true },
  ]

  const grossYieldRows: CalcRow[] = [
    { label: 'Annual rent',    value: `AED ${fmt(m.grossRent)}` },
    { label: 'Purchase price', value: `AED ${fmt(price)}` },
    { label: 'Gross yield',    value: price > 0 ? fmtPct(m.grossYield) : '—', isFinal: true },
  ]

  const cashflowRows: CalcRow[] = [
    { label: 'Annual rent',         value: `AED ${fmt(m.grossRent)}` },
    { label: 'Service charge (−)',   value: `−AED ${fmt(m.serviceCharge)}`, negative: true },
    ...(mortgageOn ? [{ label: 'Mortgage payments (−)', value: `−AED ${fmt(m.annualMortgageCost)}`, negative: true } as CalcRow] : []),
    { label: 'Net cashflow',         value: `AED ${fmt(m.annualCashflow)}`, isFinal: true },
  ]

  const cashDeployed = mortgageOn ? m.upfrontCash : m.totalAllIn
  const cocRows: CalcRow[] = [
    { label: 'Net cashflow',    value: `AED ${fmt(m.annualCashflow)}`, negative: m.annualCashflow < 0 },
    ...(mortgageOn
      ? [
          { label: 'Deposit',             value: `AED ${fmt(m.depositAmount)}` } as CalcRow,
          { label: 'Acquisition costs',   value: `AED ${fmt(m.acquisitionCosts)}` } as CalcRow,
          { label: 'Cash deployed',       value: `AED ${fmt(cashDeployed)}` } as CalcRow,
        ]
      : [{ label: 'Cash deployed (total all-in)', value: `AED ${fmt(cashDeployed)}` } as CalcRow]),
    { label: 'Cash-on-cash',    value: price > 0 ? fmtPct(m.displayCashOnCash) : '—', isFinal: true },
  ]

  return (
    <div className="space-y-4">

      {/* Metric cards */}
      <div className={`grid grid-cols-2 gap-4 ${mortgageOn ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <CalcCard label="Net yield" value={price > 0 ? fmtPct(m.netYield) : '—'}
          sub="After service charge" mint
          rows={netYieldRows} formula="net income ÷ purchase price" />
        <CalcCard label="Gross yield" value={price > 0 ? fmtPct(m.grossYield) : '—'}
          sub={`AED ${fmt(m.grossRent)} / yr`}
          rows={grossYieldRows} formula="annual rent ÷ purchase price" />
        <CalcCard label="Annual cashflow" value={price > 0 ? `AED ${fmt(m.annualCashflow)}` : '—'}
          sub={mortgageOn ? 'net income – mortgage' : 'net income'}
          rows={cashflowRows}
          formula={mortgageOn ? 'rent − service charge − mortgage' : 'rent − service charge'} />
        <CalcCard label="Cash-on-cash" value={price > 0 ? fmtPct(m.displayCashOnCash) : '—'}
          sub={mortgageOn ? 'leveraged return' : 'unleveraged'}
          mint={m.displayCashOnCash >= 0}
          rows={cocRows} formula="net cashflow ÷ cash deployed" />
        {mortgageOn && (
          <RoeCard m={m} price={price} rent={rent} rentGrowth={rentGrowth}
            interestRate={interestRate} termYears={termYears} />
        )}
      </div>

      {/* Break-even rent */}
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

      {/* Year-by-year cashflow */}
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

      {/* Variables */}
      <Card>
        <CardHeader title="Variables" />
        <div className="px-5 pb-5 pt-3 space-y-5">
          <RangeSlider label="Annual rent" value={rent} min={rentMin} max={rentMax} step={5000}
            display={`AED ${fmt(rent)}`} onChange={setRent} />
          <RangeSlider label="Annual rent growth" value={rentGrowth} min={0} max={10} step={0.5}
            display={fmtPct(rentGrowth)} onChange={setRentGrowth} />
          <ExplorationNote />
        </div>
      </Card>

    </div>
  )
}

// ─── Tab 3: Growth ────────────────────────────────────────────────────────────

function TabGrowth({
  m, mortgageOn, price, growth, setGrowth, propertyType, handoverValue, setHandoverValue,
  interestRate, termYears, paymentPlan, completion,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number; growth: number; setGrowth: (v: number) => void
  propertyType: 'offplan' | 'secondary'; handoverValue: number; setHandoverValue: (v: number) => void
  interestRate: number; termYears: number; paymentPlan: PlanRow[]; completion: string
}) {
  // Equity position (rows 0–5)
  const monthlyRate = interestRate / 100 / 12
  const termMonths  = termYears * 12
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
    const balance   = mortgageBalance(y)
    const equity    = propValue - balance
    return { year: y, propValue, balance, equity, equityPct: propValue > 0 ? (equity / propValue) * 100 : 0 }
  })

  // Exit scenarios — rates as multipliers of the user's base growth
  const conservativeRate = Math.round(growth * 0.6 * 10) / 10
  const optimisticRate   = Math.round(growth * 1.5 * 10) / 10
  const cashDeployed     = mortgageOn ? m.upfrontCash : m.totalAllIn

  const scenarios = [
    { label: 'Conservative', rate: conservativeRate, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Base case',    rate: growth,           color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Optimistic',   rate: optimisticRate,   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100'   },
  ].map(s => {
    const exitVal       = growthBase * Math.pow(1 + s.rate / 100, 5)
    const capitalGain   = exitVal - price
    const rentalIncome5 = m.netIncome * 5
    const totalRet      = capitalGain + rentalIncome5
    const rocd          = cashDeployed > 0 ? (totalRet / cashDeployed) * 100 : null
    const irr           = buildAndSolveIRR({
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

      {/* Total 5yr return */}
      {price > 0 && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total 5yr return (base case)</p>
            <p className="text-sm text-emerald-600">Rental income + capital gain at {growth.toFixed(1)}%/yr growth</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 flex-shrink-0">AED {fmtK(m.totalReturnY5)}</p>
        </div>
      )}

      {/* Gain on paper */}
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

      {/* Projection grid */}
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

      {/* Equity position */}
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
                    <td className="py-2.5 font-medium text-gray-700">{r.year === 0 ? offplanWithHandover ? 'Handover' : 'Today' : `Yr ${r.year}`}</td>
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

      {/* Variables */}
      <Card>
        <CardHeader title="Variables" />
        <div className="px-5 pb-5 pt-3 space-y-5">
          <RangeSlider label="Capital growth" value={growth} min={0} max={15} step={0.5}
            display={fmtPct(growth)} onChange={setGrowth} />
          {propertyType === 'offplan' && price > 0 && (
            <HandoverSlider
              value={handoverValue}
              min={Math.floor(price * 0.85 / 100000) * 100000}
              max={Math.ceil(price  * 1.6  / 100000) * 100000}
              step={50000}
              onChange={setHandoverValue}
            />
          )}
          <ExplorationNote />
        </div>
      </Card>

      {/* Exit scenarios */}
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

// ─── Tab 4: Financing ─────────────────────────────────────────────────────────

function TabFinancing({
  m, mortgageOn, price, paymentPlan,
  dldPct, agencyFeePct, adminFee,
  depositPct, setDepositPct, interestRate, setRate, termYears,
}: {
  m: DealMetrics; mortgageOn: boolean; price: number; paymentPlan: PlanRow[]
  dldPct: number; agencyFeePct: number; adminFee: number
  depositPct: number; setDepositPct: (v: number) => void
  interestRate: number; setRate: (v: number) => void; termYears: number
}) {
  const spread = m.netYield - interestRate
  const totalInterest = mortgageOn ? m.monthlyPayment * termYears * 12 - m.loanAmount : 0

  return (
    <div className="space-y-4">

      {/* Cash required */}
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

      {/* Total cost of debt */}
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

      {/* Acquisition costs */}
      <Card>
        <CardHeader title="Acquisition costs" />
        <div className="px-5 py-2">
          <StatRow label="Property price"        value={`AED ${fmt(price)}`} />
          <StatRow label={`DLD fee (${dldPct}%)`} value={`AED ${fmt(m.dldFee)}`} />
          {agencyFeePct > 0 && <StatRow label={`Agency fee (${agencyFeePct}%)`} value={`AED ${fmt(m.agencyFeeAmt)}`} />}
          {adminFee > 0 && <StatRow label="Admin fee" value={`AED ${fmt(adminFee)}`} />}
          <div className="border-t border-gray-100 mt-1">
            <StatRow label="Total all-in" value={`AED ${fmt(m.totalAllIn)}`} bold />
          </div>
        </div>
      </Card>

      {/* Payment plan */}
      {paymentPlan.length > 0 && (
        <Card>
          <CardHeader title="Payment plan" />
          <div className="px-5 pb-5 pt-3">
            {/* Colour progress bar */}
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

      {/* Mortgage details */}
      {mortgageOn && (
        <Card>
          <CardHeader title="Mortgage" />
          <div className="px-5 pb-5 pt-4 space-y-5">
            {/* Prominent sliders */}
            <RangeSlider label="Deposit" value={depositPct} min={10} max={80} step={5}
              display={`${depositPct}%  (AED ${fmt(m.depositAmount)})`}
              onChange={setDepositPct} prominent />
            <RangeSlider label="Interest rate" value={interestRate} min={2} max={10} step={0.1}
              display={`${interestRate.toFixed(1)}%`}
              onChange={setRate} prominent />

            {/* Live summary */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 border-t border-gray-100">
              {[
                { label: 'Loan amount',             value: `AED ${fmt(m.loanAmount)}` },
                { label: 'Deposit amount',           value: `AED ${fmt(m.depositAmount)}` },
                { label: 'Monthly payment',          value: `AED ${fmt(m.monthlyPayment)}` },
                { label: 'Annual mortgage cost',     value: `AED ${fmt(m.annualMortgageCost)}` },
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

            <ExplorationNote />
          </div>
        </Card>
      )}

    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealAnalysis({ deal, isPublic = false }: { deal: StoredDeal; isPublic?: boolean }) {
  const p = deal.params

  // Fixed deal parameters
  const price           = p.price        ?? 0
  const propertyType    = (p.propertyType ?? 'offplan') as 'offplan' | 'secondary'
  const propertySubType = (p.propertySubType ?? 'apartment') as 'apartment' | 'townhouse' | 'villa'
  const isApartment     = propertySubType === 'apartment'
  const internalSqft    = p.internalSqft ?? 0
  const balconySqft     = p.balconySqft  ?? 0
  // buaSqft: explicit for townhouse/villa; falls back to internal+balcony for apartments
  const buaSqft         = p.buaSqft ?? (internalSqft + balconySqft)
  const plotSqft        = p.plotSqft ?? 0
  const scRate          = p.serviceCharge ?? 0
  const dldPct       = p.dld          ?? 4
  const agencyFeePct = p.agencyFee    ?? 0
  const adminFee     = p.adminFee     ?? 0
  const completion   = p.completion   ?? ''
  const developer    = p.developer    ?? ''

  // Adjustable variables — initialised from saved deal
  const [activeTab,    setActiveTab]  = useState<TabName>('Overview')
  const [rent,         setRent]       = useState(p.rent          ?? 0)
  const [rentGrowth,   setRentGrowth] = useState(0)
  const [growth,       setGrowth]     = useState(p.growth        ?? 5)
  const [handoverValue, setHoVal]     = useState(p.handoverValue ?? 0)
  const [depositPct,   setDepositPct] = useState(p.depositPct   ?? 20)
  const [interestRate, setRate]       = useState(p.interestRate  ?? 4)
  const termYears                     = p.termYears              ?? 25
  const mortgageOn                    = p.mortgageOn             ?? false

  const paymentPlan: PlanRow[] = useMemo(() => {
    try { return JSON.parse(p.paymentPlan ?? '[]') }
    catch { return [] }
  }, [p.paymentPlan])

  // All metrics recalculate whenever any variable changes
  const m = useMemo(() => computeDealMetrics({
    propertyType, price, rent, growth,
    internalSqft, balconySqft,
    buaSqft: isApartment ? undefined : buaSqft,
    scRate, completion, developer,
    handoverValue, paymentPlan, dldPct, agencyFeePct, adminFee,
    mortgageOn, depositPct, interestRate, termYears,
  }), [propertyType, price, rent, growth, internalSqft, balconySqft, buaSqft,
       isApartment, scRate, completion, developer, handoverValue, paymentPlan,
       dldPct, agencyFeePct, adminFee, mortgageOn, depositPct, interestRate, termYears])

  // Share
  const [copyLabel, setCopyLabel] = useState('Share')
  async function handleShare() {
    try {
      const url = `${window.location.origin}/d/${deal.id}`
      await navigator.clipboard.writeText(url).catch(() => {
        const el = document.createElement('input'); el.value = url
        document.body.appendChild(el); el.select()
        document.execCommand('copy'); document.body.removeChild(el)
      })
      setCopyLabel('Copied!')
      setTimeout(() => setCopyLabel('Share'), 2000)
    } catch { /* silent */ }
  }

  const TABS: TabName[] = ['Overview', 'Returns', 'Growth', 'Financing']

  return (
    <div className="bg-[#fafafa] min-h-screen">

      {/* ── Top bar ── */}
      <div className="bg-[#18181b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{deal.name}</h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              {[
                p.location ? `${p.location}, ${p.emirate ?? 'Dubai'}` : '',
                developer,
                p.bedrooms !== undefined ? (p.bedrooms === 0 ? 'Studio' : p.bedrooms === null ? 'Commercial' : `${p.bedrooms} Bed`) : '',
                p.typology ?? '',
                p.view,
                buaSqft > 0 ? `${buaSqft.toLocaleString()} ft² BUA` : '',
                completion ? `Completion ${completion}` : '',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {!isPublic && (
              <Link href={`/deals/${deal.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors">
                Edit deal
              </Link>
            )}
            <button onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white transition-colors">
              {copyLabel}
            </button>
            {!isPublic && (
              <Link href="/deals"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
                All deals
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab nav (sticky) ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex">
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'Overview' && (
          <TabOverview deal={deal} m={m} mortgageOn={mortgageOn} handoverValue={handoverValue} price={price} />
        )}
        {activeTab === 'Returns' && (
          <TabReturns
            m={m} mortgageOn={mortgageOn} price={price}
            rent={rent} setRent={setRent} savedRent={p.rent ?? 0}
            rentGrowth={rentGrowth} setRentGrowth={setRentGrowth}
            interestRate={interestRate} termYears={termYears}
          />
        )}
        {activeTab === 'Growth' && (
          <TabGrowth
            m={m} mortgageOn={mortgageOn} price={price}
            growth={growth} setGrowth={setGrowth}
            propertyType={propertyType}
            handoverValue={handoverValue} setHandoverValue={setHoVal}
            interestRate={interestRate} termYears={termYears}
            paymentPlan={paymentPlan} completion={completion}
          />
        )}
        {activeTab === 'Financing' && (
          <TabFinancing
            m={m} mortgageOn={mortgageOn} price={price} paymentPlan={paymentPlan}
            dldPct={dldPct} agencyFeePct={agencyFeePct} adminFee={adminFee}
            depositPct={depositPct} setDepositPct={setDepositPct}
            interestRate={interestRate} setRate={setRate} termYears={termYears}
          />
        )}
      </div>

    </div>
  )
}
