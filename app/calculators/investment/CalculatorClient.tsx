'use client'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

const BALCONY_SC_RATIO = 0.25

// ─── Developer list ───────────────────────────────────────────────────────────

const DEVELOPERS = [
  { name: 'Aldar',                  tier: 1 },
  { name: 'Arada',                  tier: 2 },
  { name: 'Azizi',                  tier: 2 },
  { name: 'Beyond',                 tier: 3 },
  { name: 'Binghatti',              tier: 2 },
  { name: 'Bloom Living',           tier: 3 },
  { name: 'Damac',                  tier: 2 },
  { name: 'Danube',                 tier: 3 },
  { name: 'Deyaar',                 tier: 2 },
  { name: 'Dubai Properties',       tier: 2 },
  { name: 'Ellington Properties',   tier: 1 },
  { name: 'Emaar',                  tier: 1 },
  { name: 'HMB Developments',       tier: 3 },
  { name: 'HRE Development',        tier: 2 },
  { name: 'Iman',                   tier: 2 },
  { name: 'Imtiaz',                 tier: 2 },
  { name: 'Majid Al Futtaim (MAF)', tier: 1 },
  { name: 'Meraas',                 tier: 1 },
  { name: 'Meraki',                 tier: 3 },
  { name: 'Modon',                  tier: 1 },
  { name: 'Nakheel',                tier: 1 },
  { name: 'Nshama',                 tier: 2 },
  { name: 'Object 1',               tier: 3 },
  { name: 'Omniyat',                tier: 1 },
  { name: 'ORA Developers',         tier: 2 },
  { name: 'RAK Properties',         tier: 2 },
  { name: 'REEF',                   tier: 3 },
  { name: 'Reportage',              tier: 3 },
  { name: 'Samana',                 tier: 3 },
  { name: 'Scope Properties',        tier: 2 },
  { name: 'Select Group',           tier: 1 },
  { name: 'Sobha',                  tier: 1 },
  { name: 'SOL',                    tier: 2 },
  { name: 'Taraf',                  tier: 3 },
  { name: 'Tiger Properties',       tier: 3 },
  { name: 'Trident',                tier: 2 },
  { name: 'Union Properties',       tier: 3 },
  { name: 'Wasl',                   tier: 1 },
  { name: 'Zaya',                   tier: 3 },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanRow = { id: string; label: string; date: string; pct: number; handover?: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Parse MM/YYYY or Q1-Q4 YYYY → Date object. Returns null if unparseable.
function parseCompletionDate(s: string): Date | null {
  if (!s) return null
  // MM/YYYY
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) {
    const month = parseInt(mmyyyy[1], 10) - 1 // 0-indexed
    const year  = parseInt(mmyyyy[2], 10)
    if (isNaN(month) || isNaN(year)) return null
    return new Date(year, month, 1)
  }
  // Q1–Q4 YYYY (legacy)
  const quarter = s.match(/^Q([1-4])\s+(\d{4})$/i)
  if (quarter) {
    const monthMap: Record<string, number> = { '1': 2, '2': 5, '3': 8, '4': 11 } // 0-indexed
    return new Date(parseInt(quarter[2], 10), monthMap[quarter[1]], 1)
  }
  return null
}

// Returns exact months from today to completion date, or null if not parseable.
function getMonthsToCompletion(s: string): number | null {
  const d = parseCompletionDate(s)
  if (!d) return null
  const now = new Date()
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
  return Math.max(0, months)
}

// Returns fractional years from today to completion date, or null if not parseable.
// Uses months/12 — NOT Math.ceil — so annualised gain denominator is accurate.
function getYearsToCompletion(s: string): number | null {
  const months = getMonthsToCompletion(s)
  if (months === null) return null
  return months / 12
}

// Normalise legacy "Q1 2028" → "03/2028" for the stored/displayed value in the input field.
function normalizeCompletionDate(s: string): string {
  const q = s.trim().match(/^Q([1-4])\s*[\s/]?\s*(\d{4})$/i)
  if (q) {
    const m: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' }
    return `${m[q[1]]}/${q[2]}`
  }
  return s
}

const PLAN_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-orange-500',
  'bg-purple-600', 'bg-pink-500', 'bg-teal-400',  'bg-red-400',
]

function fmt(n: number) { return Math.round(n).toLocaleString('en-US') }
function fmtPct(n: number, dp = 1) { return n.toFixed(dp) + '%' }

// ─── IRR calculation ──────────────────────────────────────────────────────────

// Convert a free-text date string from a payment plan row into years from now.
// Falls back to 0 if unparseable.
function parseDateToYear(dateStr: string, completionYears: number): number {
  if (!dateStr) return 0
  const lower = dateStr.toLowerCase().trim()
  const yearMatch = dateStr.match(/\b(20\d\d)\b/)
  if (yearMatch) return Math.max(0, parseInt(yearMatch[1]) - new Date().getFullYear())
  if (lower.includes('now') || lower.includes('sign') || lower.includes('book')) return 0
  if (lower.includes('hand') || lower.includes('complet') || lower.includes('deliver')) return completionYears
  if (lower.includes('month') || lower.includes('during') || lower.includes('construct') || lower.includes('progress')) {
    return Math.round(completionYears / 2)
  }
  return 0
}

// Newton-Raphson IRR solver. Returns IRR as a percentage, or null if it fails.
function solveIRR(cashFlows: number[]): number | null {
  const hasNeg = cashFlows.some(c => c < 0)
  const hasPos = cashFlows.some(c => c > 0)
  if (!hasNeg || !hasPos) return null

  let rate = 0.1
  for (let iter = 0; iter < 300; iter++) {
    let npv = 0; let dnpv = 0
    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t)
      npv  += cashFlows[t] / factor
      dnpv -= t * cashFlows[t] / (factor * (1 + rate))
    }
    if (Math.abs(dnpv) < 1e-15) break
    const delta = npv / dnpv
    rate -= delta
    if (rate <= -1) rate = -0.9999
    if (Math.abs(delta) < 1e-8) return rate * 100
  }
  return null
}

// Build annual cash flow array and solve IRR.
// Secondary: single upfront purchase, income y1–y4, exit at y5.
// Off-plan: payment plan outflows timed by date, income from completion, exit at completion+5.
//   If handoverValue provided, exit basis is handoverValue grown at growth% for 5 yrs post-completion.
function buildAndSolveIRR({
  price, netIncome, growth, paymentPlan, completion, handoverValue, propertyType,
}: {
  price: number; netIncome: number; growth: number
  paymentPlan: PlanRow[]; completion: string
  handoverValue: number; propertyType: 'offplan' | 'secondary'
}): number | null {
  if (price <= 0 || netIncome <= 0) return null

  if (propertyType === 'secondary') {
    const exitYear = 5
    const flows: number[] = new Array(exitYear + 1).fill(0)
    flows[0] -= price
    for (let y = 1; y < exitYear; y++) flows[y] += netIncome
    flows[exitYear] += netIncome + price * Math.pow(1 + growth / 100, exitYear)
    return solveIRR(flows)
  }

  // Off-plan — use integer-rounded years for array indexing, fractional for accuracy
  const rawYears = getYearsToCompletion(completion)
  const safeCompletionYears = (rawYears === null || isNaN(rawYears) || rawYears < 0) ? 2 : Math.round(rawYears)
  const exitYear = safeCompletionYears + 5
  const flows: number[] = new Array(exitYear + 1).fill(0)

  // Outflows from payment plan, or single price at t=0
  if (paymentPlan.length > 0) {
    for (const row of paymentPlan) {
      const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, safeCompletionYears))), exitYear)
      flows[yr] -= price * row.pct / 100
    }
  } else {
    flows[0] -= price
  }

  // Net rental income for 5 years starting at completion (not in exit year)
  for (let y = safeCompletionYears; y < exitYear; y++) {
    flows[y] += netIncome
  }

  // Exit value: if handoverValue provided, grow from that for 5 yrs post-completion
  const exitBase = handoverValue > 0 ? handoverValue : price
  const exitGrowthYears = handoverValue > 0 ? 5 : exitYear
  flows[exitYear] += exitBase * Math.pow(1 + growth / 100, exitGrowthYears)

  return solveIRR(flows)
}

// ─── Investment score ─────────────────────────────────────────────────────────

type ScoreBreakdown = {
  yieldPts: number; devPts: number; growthPts: number; propPts: number
  preCompletionROE: number | null    // for display label
  irrBonusPts: number                // for display label
  spread: number                     // for display label
  roeValue: number                   // for display label
  bonuses: Array<{ label: string; pts: number }>
  penalties: Array<{ label: string; pts: number }>
}

function calculateInvestmentScore({
  netYield, growth, developerTier, paymentPlan, propertyType, completion,
  price, handoverValue, mortgageOn, interestRate, roeY1, irr, hasServiceCharge,
  dldPct, agencyFeePct, adminFee,
}: {
  netYield: number; growth: number; developerTier: number | null; paymentPlan: PlanRow[]
  propertyType: 'offplan' | 'secondary'; completion: string
  price: number; handoverValue: number
  mortgageOn: boolean; interestRate: number; roeY1: number; irr: number | null
  hasServiceCharge: boolean
  dldPct: number; agencyFeePct: number; adminFee: number
}): { score: number; grade: string; missingItems: string[]; breakdown: ScoreBreakdown } {

  // ── Base components (85 pts max) ─────────────────────────────────────────────

  // Net yield: 35pts max — ~5%≈22, ~6%≈30, ~7%≈34, ~8%+≈35
  const yieldPts = Math.min(35, 35 * (1 - Math.exp(-netYield / 3.5)))

  // Developer tier: 20pts (categorical — slabs correct for discrete tiers)
  let devPts = 8 // Tier 3 or none selected
  if      (developerTier === 1) devPts = 20
  else if (developerTier === 2) devPts = 14

  // Capital growth: 15pts max — ~3%≈7, ~5%≈10, ~8%≈13, ~10%+≈15
  const growthPts = Math.min(15, 15 * (1 - Math.exp(-growth / 4)))

  // Property type: 15pts — timeline only for off-plan, 15 flat for secondary
  const completionMonths = getMonthsToCompletion(completion) ?? null
  let propPts = 0
  if (propertyType === 'secondary') {
    propPts = 15
  } else {
    if (completionMonths === null)       propPts = 6
    else if (completionMonths <= 12)    propPts = 15
    else if (completionMonths <= 24)    propPts = 12
    else if (completionMonths <= 36)    propPts = 8
    else if (completionMonths <= 48)    propPts = 4
    else                                propPts = 2
  }

  let total = yieldPts + devPts + growthPts + propPts

  // ── Bonus points ─────────────────────────────────────────────────────────────
  const bonuses: ScoreBreakdown['bonuses'] = []

  // Pre-completion ROE: max 20pts. Off-plan only, requires handoverValue > price and acquisitionCosts > 0.
  const hasPaymentPlan  = paymentPlan.length > 0
  const hasHandoverRow  = hasPaymentPlan && paymentPlan.some(r => r.handover)
  const preHandoverInstalments = hasHandoverRow
    ? paymentPlan.filter(r => !r.handover).reduce((sum, r) => sum + (r.pct / 100 * price), 0)
    : price // no plan or no handover marked — assume full price deployed pre-completion
  const acquisitionCosts = (dldPct / 100 * price) + adminFee + (agencyFeePct / 100 * price)
  const cashDeployedPreCompletion = preHandoverInstalments + acquisitionCosts
  const gainOnPaperAmt = handoverValue - price
  let preCompletionROE: number | null = null
  if (
    propertyType === 'offplan' &&
    handoverValue > price &&
    price > 0 &&
    acquisitionCosts > 0 &&
    cashDeployedPreCompletion > 0
  ) {
    preCompletionROE = (gainOnPaperAmt / cashDeployedPreCompletion) * 100
    const gainBonus = Math.min(20, 20 * (1 - Math.exp(-preCompletionROE / 25)))
    if (gainBonus > 0.05) { total += gainBonus; bonuses.push({ label: `Pre-completion ROE (${preCompletionROE.toFixed(1)}%)`, pts: Math.round(gainBonus * 10) / 10 }) }
  }

  // IRR bonus: max 6pts. Only when IRR calculable and positive.
  let irrBonusPts = 0
  if (irr !== null && irr > 0) {
    irrBonusPts = Math.min(6, 6 * (1 - Math.exp(-irr / 8)))
    if (irrBonusPts > 0.05) { total += irrBonusPts; bonuses.push({ label: `IRR bonus (${irr.toFixed(1)}%)`, pts: Math.round(irrBonusPts * 10) / 10 }) }
  }

  // Positive gearing: max 5pts, mortgage active only. Based on spread.
  const spread = netYield - interestRate
  let gearingBonus = 0
  if (mortgageOn) {
    if      (spread >= 1.5) gearingBonus = 5
    else if (spread >= 0.5) gearingBonus = 2
    if (gearingBonus > 0) { total += gearingBonus; bonuses.push({ label: `Positive gearing (spread ${spread.toFixed(1)}%)`, pts: gearingBonus }) }
  }

  // Strong ROE: max 5pts, mortgage active only. Continuous curve.
  let roeBonusPts = 0
  if (mortgageOn && roeY1 > 0) {
    roeBonusPts = Math.min(5, 5 * (1 - Math.exp(-roeY1 / 6)))
    if (roeBonusPts > 0.05) { total += roeBonusPts; bonuses.push({ label: `Strong ROE (${roeY1.toFixed(1)}%)`, pts: Math.round(roeBonusPts * 10) / 10 }) }
  }

  // Low completion risk: 2pts, off-plan only, Tier 1 + completion ≤ 24 months
  if (propertyType === 'offplan' && developerTier === 1 && completionMonths !== null && completionMonths <= 24) {
    total += 2; bonuses.push({ label: 'Low completion risk', pts: 2 })
  }

  // ── Risk penalties ───────────────────────────────────────────────────────────
  const penalties: ScoreBreakdown['penalties'] = []

  if (mortgageOn && netYield < interestRate) {
    total -= 5; penalties.push({ label: 'Negative gearing', pts: -5 })
  }
  if (propertyType === 'offplan' && developerTier === 3 && completionMonths !== null && completionMonths > 36) {
    total -= 8; penalties.push({ label: 'High-risk off-plan', pts: -8 })
  }
  if (propertyType === 'offplan' && completionMonths !== null && completionMonths > 48) {
    total -= 3; penalties.push({ label: 'Very long completion', pts: -3 })
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  const score = Math.min(100, Math.max(0, Math.round(total)))
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'

  // Missing data indicator — specific items only
  const missingItems: string[] = []
  if (propertyType === 'offplan' && handoverValue <= 0)        missingItems.push('No handover value entered')
  if (propertyType === 'offplan' && !completion)               missingItems.push('No completion date entered')
  if (propertyType === 'offplan' && !hasPaymentPlan)           missingItems.push('No payment plan entered (assuming full price deployed pre-completion)')
  if (propertyType === 'offplan' && hasPaymentPlan && !hasHandoverRow) missingItems.push('No handover instalment marked in payment plan')
  if (!hasServiceCharge)                                       missingItems.push('No service charge entered')
  if (propertyType === 'offplan' && developerTier === null)    missingItems.push('No developer selected')

  return {
    score, grade, missingItems,
    breakdown: { yieldPts, devPts, growthPts, propPts, preCompletionROE, irrBonusPts, spread, roeValue: roeY1, bonuses, penalties },
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        on ? 'bg-navy-700' : 'bg-gray-300'
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        on ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

function Slider({ label, value, min, max, step, displayValue, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; displayValue: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{displayValue}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full" />
    </div>
  )
}

// Editable number field + slider in sync. Typing any value updates immediately;
// the slider snaps to the nearest step. Displayed with comma formatting.
function EditableSliderField({ label, value, min, max, step, prefix, onChange }: {
  label: string; value: number; min: number; max: number
  step: number; prefix?: string; onChange: (v: number) => void
}) {
  const [raw, setRaw]         = useState('')
  const [editing, setEditing] = useState(false)

  function commit(str: string) {
    const n = parseFloat(str.replace(/,/g, ''))
    if (!isNaN(n) && n >= 0) onChange(Math.min(max * 2, n)) // allow above slider max when typed
    setEditing(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-xs text-gray-400">{prefix}</span>}
          <input
            type="text"
            inputMode="numeric"
            className="w-36 text-right text-sm font-semibold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-navy-700 focus:bg-white"
            value={editing ? raw : fmt(value)}
            onFocus={() => { setRaw(String(value)); setEditing(true) }}
            onChange={e => setRaw(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commit((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditing(false)
            }}
          />
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={Math.min(value, max)}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

function MetricCard({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: boolean
}) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function LineItem({ label, value, bold, positive, negative }: {
  label: string; value: string; bold?: boolean; positive?: boolean; negative?: boolean
}) {
  return (
    <div className={`flex justify-between items-baseline py-1.5 ${bold ? 'border-t border-gray-100 mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${
        bold && positive ? 'text-green-700' : bold ? 'text-gray-900' : negative ? 'text-red-600' : 'text-gray-700'
      }`}>{value}</span>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-t border-gray-50 first:border-t-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value || '—'}</span>
    </div>
  )
}

// Tooltip renders into a portal so overflow:auto ancestors never clip it.
function Tooltip({ lines }: { lines: string[] }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const position = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setCoords({ top: r.top - 8, left: r.left + r.width / 2 })
  }, [])

  return (
    <span className="inline-flex items-center ml-1">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => { position(); setVisible(true) }}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => { position(); setVisible(true) }}
        onBlur={() => setVisible(false)}
        className="w-3.5 h-3.5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 text-[9px] font-bold flex items-center justify-center cursor-help focus:outline-none transition-colors"
        aria-label="More information"
      >
        ?
      </button>
      {visible && mounted && createPortal(
        <span
          className="fixed z-[200] w-64 bg-gray-800 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl pointer-events-none leading-relaxed"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)' }}
        >
          {lines.map((line, i) => (
            <span key={i} className={`block ${i > 0 ? 'mt-1' : ''} ${line.startsWith('Total') ? 'border-t border-gray-600 pt-1 mt-1.5 font-semibold' : ''}`}>
              {line}
            </span>
          ))}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </span>,
        document.body
      )}
    </span>
  )
}

// MetricCard with hover breakdown popover (fixed-position portal, same z-index fix)
function NetIncomeMetricCard({ netIncome, grossRent, serviceCharge }: {
  netIncome: number; grossRent: number; serviceCharge: number
}) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, width: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function position() {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    setCoords({ top: r.top - 8, left: r.left + r.width / 2, width: r.width })
  }

  const hasData = grossRent > 0

  return (
    <div
      ref={cardRef}
      className="bg-white rounded-xl p-5 relative cursor-default"
      style={{ border: '0.5px solid rgba(0,0,0,0.12)' }}
      onMouseEnter={() => { if (hasData) { position(); setVisible(true) } }}
      onMouseLeave={() => setVisible(false)}
    >
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Net annual income</p>
      <p className="text-2xl font-bold text-gray-900">{grossRent > 0 ? Math.round(netIncome).toLocaleString('en-US') : '—'}</p>
      <p className="text-xs text-gray-400 mt-0.5">AED / year</p>
      {visible && hasData && mounted && createPortal(
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 pointer-events-none text-xs"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)', minWidth: Math.max(coords.width, 200) }}
        >
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">Gross rent</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {Math.round(grossRent).toLocaleString('en-US')}</span>
          </div>
          <div className="flex justify-between gap-6 mb-2">
            <span className="text-gray-500">Service charge</span>
            <span className="font-medium text-red-600 tabular-nums">– AED {Math.round(serviceCharge).toLocaleString('en-US')}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2">
            <span className="font-semibold text-gray-800">Net annual income</span>
            <span className="font-bold text-green-700 tabular-nums">AED {Math.round(netIncome).toLocaleString('en-US')}</span>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-200" style={{ marginTop: -1 }} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[3.5px] border-transparent border-t-white" />
        </div>,
        document.body
      )}
    </div>
  )
}

function GainOnPaperCard({
  handoverValue, price, gainOnPaper, gainOnPaperPct,
  preHandoverInstalments, dldFee, adminFee, agencyFeeAmt, agencyFeePct,
  cashDeployedPreCompletion, preCompletionROE, noPaymentPlan,
}: {
  handoverValue: number; price: number; gainOnPaper: number; gainOnPaperPct: number
  preHandoverInstalments: number; dldFee: number; adminFee: number
  agencyFeeAmt: number; agencyFeePct: number
  cashDeployedPreCompletion: number; preCompletionROE: number; noPaymentPlan: boolean
}) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, width: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function position() {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    setCoords({ top: r.top - 8, left: r.left + r.width / 2, width: r.width })
  }

  const isPositive = gainOnPaper >= 0

  return (
    <div
      ref={cardRef}
      className={`rounded-xl p-5 border cursor-default ${isPositive ? 'bg-[#E8F5EE] border-green-200' : 'bg-amber-50 border-amber-100'}`}
      onMouseEnter={() => { position(); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
    >
      <p className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-400">Gain on paper</p>
      <p className={`text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-amber-600'}`}>
        {isPositive ? '+' : '–'}AED {fmt(Math.abs(gainOnPaper))}
      </p>
      <p className={`text-sm font-semibold mt-0.5 ${isPositive ? 'text-green-600' : 'text-amber-500'}`}>
        {gainOnPaperPct >= 0 ? '+' : ''}{gainOnPaperPct.toFixed(1)}% vs purchase price
      </p>
      {cashDeployedPreCompletion > 0 && (
        <p className={`text-sm font-semibold mt-0.5 ${preCompletionROE >= 0 ? 'text-green-600' : 'text-amber-500'}`}>
          {preCompletionROE >= 0 ? '+' : ''}{preCompletionROE.toFixed(1)}% on capital deployed
        </p>
      )}
      <p className="text-xs text-gray-400 mt-1">Estimated handover value minus purchase price</p>

      {visible && mounted && createPortal(
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 pointer-events-none text-xs"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)', minWidth: Math.max(coords.width, 260) }}
        >
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">Est. value at handover</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(handoverValue)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-2">
            <span className="text-gray-500">Purchase price</span>
            <span className="font-medium text-gray-800 tabular-nums">– AED {fmt(price)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mb-3">
            <span className="font-semibold text-gray-800">Gain on paper</span>
            <span className={`font-bold tabular-nums ${isPositive ? 'text-green-700' : 'text-amber-600'}`}>
              {isPositive ? '+' : '–'}AED {fmt(Math.abs(gainOnPaper))} ({gainOnPaperPct >= 0 ? '+' : ''}{gainOnPaperPct.toFixed(1)}%)
            </span>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Pre-completion cash deployed</p>
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">Pre-handover instalments{noPaymentPlan && <span className="text-amber-500">*</span>}</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(preHandoverInstalments)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">DLD fee</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(dldFee)}</span>
          </div>
          {adminFee > 0 && (
            <div className="flex justify-between gap-6 mb-1">
              <span className="text-gray-500">Admin / Oqood</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(adminFee)}</span>
            </div>
          )}
          {agencyFeePct > 0 && (
            <div className="flex justify-between gap-6 mb-1">
              <span className="text-gray-500">Agency fee</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(agencyFeeAmt)}</span>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mb-2">
            <span className="font-semibold text-gray-800">Total deployed</span>
            <span className="font-bold text-gray-800 tabular-nums">AED {fmt(cashDeployedPreCompletion)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2">
            <span className="font-semibold text-gray-800">Return on deployed capital</span>
            <span className={`font-bold tabular-nums ${preCompletionROE >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {preCompletionROE.toFixed(1)}%
            </span>
          </div>
          {noPaymentPlan && (
            <p className="text-[10px] text-amber-600 mt-2">* Assumed — no payment plan entered.</p>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-200" style={{ marginTop: -1 }} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[3.5px] border-transparent border-t-white" />
        </div>,
        document.body
      )}
    </div>
  )
}

function ROEMetricCard({
  netIncome, annualMortgageCost, principalY1, upfrontCash,
  depositAmount, dldFee, adminFee, agencyFeeAmt, agencyFeePct,
  roeY1, roeY3, roeY5,
}: {
  netIncome: number; annualMortgageCost: number; principalY1: number
  upfrontCash: number; depositAmount: number; dldFee: number
  adminFee: number; agencyFeeAmt: number; agencyFeePct: number
  roeY1: number; roeY3: number; roeY5: number
}) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, width: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function position() {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    setCoords({ top: r.top - 8, left: r.left + r.width / 2, width: r.width })
  }

  const totalReturnY1 = netIncome - annualMortgageCost + principalY1
  const isPositive    = roeY1 >= 0

  return (
    <div
      ref={cardRef}
      className={`rounded-lg p-4 cursor-default ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}
      onMouseEnter={() => { position(); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
    >
      <p className="text-xs text-gray-400 mb-1">Return on equity</p>
      <p className={`text-lg font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>{roeY1.toFixed(1)}%</p>
      <p className="text-[10px] text-gray-400 mt-1 tabular-nums">
        Y1 {roeY1.toFixed(1)}% · Y3 {roeY3.toFixed(1)}% · Y5 {roeY5.toFixed(1)}%
      </p>
      {visible && mounted && createPortal(
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 pointer-events-none text-xs"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)', minWidth: Math.max(coords.width, 280) }}
        >
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">Net annual income</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(netIncome)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">− Annual debt service</span>
            <span className="font-medium text-gray-800 tabular-nums">− AED {fmt(annualMortgageCost)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">+ Principal repaid (Yr 1)</span>
            <span className="font-medium text-gray-800 tabular-nums">+ AED {fmt(principalY1)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mb-3">
            <span className="font-semibold text-gray-800">Total return (Yr 1)</span>
            <span className={`font-bold tabular-nums ${totalReturnY1 >= 0 ? 'text-green-700' : 'text-red-600'}`}>AED {fmt(totalReturnY1)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="font-semibold text-gray-800">Total equity deployed</span>
            <span className="font-bold text-gray-800 tabular-nums">AED {fmt(upfrontCash)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1 pl-3">
            <span className="text-gray-500">Deposit</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(depositAmount)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1 pl-3">
            <span className="text-gray-500">DLD fee</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(dldFee)}</span>
          </div>
          {adminFee > 0 && (
            <div className="flex justify-between gap-6 mb-1 pl-3">
              <span className="text-gray-500">Admin / Oqood</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(adminFee)}</span>
            </div>
          )}
          {agencyFeePct > 0 && (
            <div className="flex justify-between gap-6 mb-1 pl-3">
              <span className="text-gray-500">Agency fee</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(agencyFeeAmt)}</span>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mt-1">
            <span className="font-semibold text-gray-800">Return on equity (Yr 1)</span>
            <span className={`font-bold tabular-nums ${isPositive ? 'text-green-700' : 'text-red-600'}`}>{roeY1.toFixed(1)}%</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 tabular-nums">
            Y1 {roeY1.toFixed(1)}% · Y3 {roeY3.toFixed(1)}% · Y5 {roeY5.toFixed(1)}%
          </p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-200" style={{ marginTop: -1 }} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[3.5px] border-transparent border-t-white" />
        </div>,
        document.body
      )}
    </div>
  )
}

function CoCMetricCard({
  netIncome, annualMortgageCost, netCashFlow, upfrontCash,
  depositAmount, dldFee, adminFee, agencyFeeAmt, agencyFeePct, cashOnCash,
}: {
  netIncome: number; annualMortgageCost: number; netCashFlow: number
  upfrontCash: number; depositAmount: number; dldFee: number
  adminFee: number; agencyFeeAmt: number; agencyFeePct: number; cashOnCash: number
}) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, width: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function position() {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    setCoords({ top: r.top - 8, left: r.left + r.width / 2, width: r.width })
  }

  const isPositive = cashOnCash >= 0

  return (
    <div
      ref={cardRef}
      className={`rounded-lg p-4 cursor-default ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}
      onMouseEnter={() => { position(); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
    >
      <p className="text-xs text-gray-400 mb-1">Cash-on-cash return</p>
      <p className={`text-lg font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>{cashOnCash.toFixed(1)}%</p>
      <p className="text-xs text-gray-400 mt-0.5">net cash flow / cash deployed</p>
      {visible && mounted && createPortal(
        <div
          className="fixed z-[200] bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 pointer-events-none text-xs"
          style={{ top: coords.top, left: coords.left, transform: 'translate(-50%, -100%)', minWidth: Math.max(coords.width, 280) }}
        >
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">Net annual income</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(netIncome)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="text-gray-500">− Annual debt service</span>
            <span className="font-medium text-gray-800 tabular-nums">− AED {fmt(annualMortgageCost)}</span>
          </div>
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mb-3">
            <span className="font-semibold text-gray-800">Net annual cashflow</span>
            <span className={`font-bold tabular-nums ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>AED {fmt(netCashFlow)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1">
            <span className="font-semibold text-gray-800">Total equity deployed</span>
            <span className="font-bold text-gray-800 tabular-nums">AED {fmt(upfrontCash)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1 pl-3">
            <span className="text-gray-500">Deposit</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(depositAmount)}</span>
          </div>
          <div className="flex justify-between gap-6 mb-1 pl-3">
            <span className="text-gray-500">DLD fee</span>
            <span className="font-medium text-gray-800 tabular-nums">AED {fmt(dldFee)}</span>
          </div>
          {adminFee > 0 && (
            <div className="flex justify-between gap-6 mb-1 pl-3">
              <span className="text-gray-500">Admin / Oqood</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(adminFee)}</span>
            </div>
          )}
          {agencyFeePct > 0 && (
            <div className="flex justify-between gap-6 mb-1 pl-3">
              <span className="text-gray-500">Agency fee</span>
              <span className="font-medium text-gray-800 tabular-nums">AED {fmt(agencyFeeAmt)}</span>
            </div>
          )}
          <div className="flex justify-between gap-6 border-t border-gray-100 pt-2 mt-1">
            <span className="font-semibold text-gray-800">Cash-on-cash return</span>
            <span className={`font-bold tabular-nums ${isPositive ? 'text-green-700' : 'text-red-600'}`}>{cashOnCash.toFixed(1)}%</span>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-200" style={{ marginTop: -1 }} />
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[3.5px] border-transparent border-t-white" />
        </div>,
        document.body
      )}
    </div>
  )
}

function DeveloperDropdown({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState(value)
  const [open, setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        // Keep custom entries; only revert if query doesn't match any known dev AND isn't the current value
        const isKnown = DEVELOPERS.find(d => d.name === query)
        if (!isKnown && query !== value) setQuery(value)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [query, value])

  const trimmed  = query.trim()
  const filtered = DEVELOPERS.filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase())
  )
  // Show custom "add" option if query is non-empty and doesn't exactly match a known developer
  const showAddOption = trimmed.length > 0 && !DEVELOPERS.find(d => d.name.toLowerCase() === trimmed.toLowerCase())

  return (
    <div ref={ref} className="relative w-48">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search developers…"
        className="w-full border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-navy-700 focus:bg-white"
      />
      {open && (filtered.length > 0 || showAddOption) && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-52 overflow-y-auto">
          {filtered.map(dev => (
            <button
              key={dev.name}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(dev.name); setQuery(dev.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-gray-100"
            >
              {dev.name}
            </button>
          ))}
          {showAddOption && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onChange(trimmed); setQuery(trimmed); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 font-medium hover:bg-gray-100 border-t border-gray-100"
            >
              + Add &ldquo;{trimmed}&rdquo; as developer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorClient() {
  const searchParams = useSearchParams()

  // Sliders
  const [price,  setPrice]  = useState(0)
  const [rent,   setRent]   = useState(0)
  const [growth, setGrowth] = useState(5)

  // Property details
  const [internalSqft, setInternal]   = useState(0)
  const [balconySqft,  setBalcony]    = useState(0)
  const [project,      setProject]    = useState('')
  const [unit,         setUnit]       = useState('')
  const [view,         setView]       = useState('')
  const [completion,   setCompletion] = useState('')
  const [developer,    setDeveloper]  = useState('')

  // Edit mode
  const [editingDetails, setEditingDetails] = useState(false)

  // Share
  const [copied, setCopied] = useState(false)

  // Save Deal
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName,      setSaveName]      = useState('')
  const [saveError,     setSaveError]     = useState('')
  const [saveFeedback,  setSaveFeedback]  = useState(false)
  const [dupModal, setDupModal] = useState<{
    existingId: string; existingName: string
    payload: Record<string, unknown>
  } | null>(null)
  const [dealsIndex, setDealsIndex] = useState<{ id: string; name: string; savedAt: string; updatedAt?: string }[]>([])

  // UI toggles
  const [showBreakdown,      setShowBreakdown]      = useState(false)
  const [returnMetricsOpen,  setReturnMetricsOpen]  = useState(true)
  const [capitalGrowthOpen,  setCapitalGrowthOpen]  = useState(true)
  const [planOpen,           setPlanOpen]           = useState(false)

  // Property type
  const [propertyType, setPropertyType] = useState<'offplan' | 'secondary'>('offplan')

  // Estimated handover value (off-plan only)
  const [handoverValue, setHandoverValue] = useState(0)

  // Property details collapse
  const [detailsOpen, setDetailsOpen] = useState(true)

  // Service charge — blank by default; only populated via URL param or manual edit
  const [scRate,  setScRate]  = useState(0)
  const [scInput, setScInput] = useState('')

  // Payment plan
  const [paymentPlan, setPaymentPlan] = useState<PlanRow[]>([])

  // Acquisition costs
  const [dldPct,         setDldPct]         = useState(4)
  const [dldInput,       setDldInput]       = useState('4')
  const [agencyFeePct,   setAgencyFeePct]   = useState(0)
  const [agencyFeeInput, setAgencyFeeInput] = useState('')
  const [adminFee,       setAdminFee]       = useState(0)
  const [adminFeeInput,  setAdminFeeInput]  = useState('')

  // Mortgage
  const [mortgageOn,   setMortgageOn]   = useState(false)
  const [depositPct,   setDepositPct]   = useState(25)
  const [interestRate, setInterestRate] = useState(4.0)
  const [termYears,    setTermYears]    = useState(25)
  const [mortgageType, setMortgageType] = useState<'repayment' | 'interest-only'>('repayment')

  // ── URL params ────────────────────────────────────────────────────────────
  useEffect(() => {
    const s  = searchParams
    const gn = (k: string) => { const v = s.get(k); return v !== null ? Number(v) : null }

    const p     = gn('price');         if (p     !== null) setPrice(p)
    const r     = gn('rent');          if (r     !== null) setRent(r)
    const g     = gn('growth');        if (g     !== null) setGrowth(g)
    const isqft = gn('internalSqft');  if (isqft !== null) setInternal(isqft)
    const bsqft = gn('balconySqft');   if (bsqft !== null) setBalcony(bsqft)
    const sc    = gn('serviceCharge'); if (sc    !== null) { setScRate(sc); setScInput(String(sc)) }
    const dld   = gn('dld');          if (dld   !== null) { setDldPct(dld); setDldInput(String(dld)) }
    const af    = gn('agencyFee');    if (af    !== null) { setAgencyFeePct(af); setAgencyFeeInput(String(af)) }
    const adm   = gn('adminFee');     if (adm   !== null) { setAdminFee(adm); setAdminFeeInput(String(adm)) }

    const pt = s.get('propertyType')
    if (pt === 'offplan' || pt === 'secondary') setPropertyType(pt)
    const hv = gn('handoverValue'); if (hv !== null && hv > 0) setHandoverValue(hv)

    const mo = s.get('mortgageOn'); if (mo === 'true') setMortgageOn(true)
    const dep  = gn('depositPct');   if (dep  !== null) setDepositPct(dep)
    const ir   = gn('interestRate'); if (ir   !== null) setInterestRate(ir)
    const ty   = gn('termYears');    if (ty   !== null) setTermYears(ty)
    const mt = s.get('mortgageType')
    if (mt === 'repayment' || mt === 'interest-only') setMortgageType(mt)

    const proj = s.get('project');    if (proj)    setProject(proj)
    const u    = s.get('unit');       if (u)       setUnit(u)
    const vw   = s.get('view');       if (vw)      setView(vw)
    const comp = s.get('completion'); if (comp)    setCompletion(normalizeCompletionDate(comp))
    const dev  = s.get('developer');  if (dev)     setDeveloper(dev)

    const pp = s.get('paymentPlan')
    if (pp) {
      try {
        const parsed = JSON.parse(decodeURIComponent(pp))
        if (Array.isArray(parsed)) {
          setPaymentPlan(parsed.map((row: { label?: string; date?: string; pct?: number; handover?: boolean }, i: number) => ({
            id:       `init-${i}`,
            label:    String(row.label ?? ''),
            date:     String(row.date  ?? ''),
            pct:      Number(row.pct   ?? 0),
            handover: Boolean(row.handover),
          })))
          if (parsed.length > 0) setPlanOpen(true)
        }
      } catch { /* malformed JSON */ }
    }

    // Auto-collapse property details when key fields are pre-filled from URL
    if (s.get('project') && s.get('internalSqft') && s.get('serviceCharge')) {
      setDetailsOpen(false)
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/user/deals')
      .then(r => r.json())
      .then(setDealsIndex)
      .catch(() => {})
  }, [])

  // ── Share URL ─────────────────────────────────────────────────────────────
  function buildDealParams(): Record<string, unknown> {
    const p: Record<string, unknown> = {}
    if (propertyType !== 'offplan') p.propertyType = propertyType
    if (handoverValue > 0)          p.handoverValue = handoverValue
    if (price > 0)        p.price        = price
    if (rent > 0)         p.rent         = rent
    if (growth !== 5)     p.growth       = growth
    if (internalSqft > 0) p.internalSqft = internalSqft
    if (balconySqft > 0)  p.balconySqft  = balconySqft
    if (project)          p.project      = project
    if (unit)             p.unit         = unit
    if (view)             p.view         = view
    if (completion)       p.completion   = completion
    if (developer)        p.developer    = developer
    if (scRate > 0)         p.serviceCharge = scRate
    if (dldPct !== 4)       p.dld           = dldPct
    if (agencyFeePct !== 0) p.agencyFee     = agencyFeePct
    if (adminFee > 0)       p.adminFee      = adminFee
    if (paymentPlan.length > 0) {
      p.paymentPlan = JSON.stringify(
        paymentPlan.map(r => ({ label: r.label, date: r.date, pct: r.pct, ...(r.handover ? { handover: true } : {}) }))
      )
    }
    if (mortgageOn) {
      p.mortgageOn   = true
      p.depositPct   = depositPct
      p.interestRate = interestRate
      p.termYears    = termYears
      if (mortgageType !== 'repayment') p.mortgageType = mortgageType
    }
    return p
  }

  async function handleShare() {
    const params = buildDealParams()
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const { id } = await res.json()
    const url = `${window.location.origin}/deals/${id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Calculations ──────────────────────────────────────────────────────────

  const totalSqft     = internalSqft + balconySqft
  const balconyRate   = scRate * BALCONY_SC_RATIO
  const serviceCharge = internalSqft * scRate + balconySqft * balconyRate

  const grossYield    = price > 0 ? (rent / price) * 100 : 0
  const netIncome     = rent - serviceCharge
  const netYield      = price > 0 ? (netIncome / price) * 100 : 0
  const pricePerSqft  = totalSqft > 0 && price > 0 ? price / totalSqft : 0

  // Acquisition cost calculations (driven by editable state)
  const dldFee       = price * dldPct / 100
  const agencyFeeAmt = price * agencyFeePct / 100
  const totalAllIn   = price + dldFee + agencyFeeAmt + adminFee

  // Mortgage
  const loanAmount         = price * (1 - depositPct / 100)
  const depositAmount      = price * (depositPct / 100)
  const monthlyRate        = interestRate / 100 / 12
  const termMonths         = termYears * 12
  const monthlyPayment     = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : loanAmount / termMonths
  const annualMortgageCost = monthlyPayment * 12
  const netCashFlow        = netIncome - annualMortgageCost
  const upfrontCash        = depositAmount + dldFee + agencyFeeAmt + adminFee
  const cashOnCash         = upfrontCash > 0 ? (netCashFlow / upfrontCash) * 100 : 0

  // ROE calculations (mortgage mode only)
  const balanceAfterYear = (y: number) =>
    monthlyRate > 0
      ? loanAmount * Math.pow(1 + monthlyRate, y * 12) - monthlyPayment * (Math.pow(1 + monthlyRate, y * 12) - 1) / monthlyRate
      : Math.max(0, loanAmount - monthlyPayment * y * 12)
  const principalInYear = (y: number) => {
    const open = y === 1 ? loanAmount : Math.max(0, balanceAfterYear(y - 1))
    const close = Math.max(0, balanceAfterYear(y))
    return Math.max(0, open - close)
  }
  const roeYear = (y: number) =>
    upfrontCash > 0 ? (netIncome - annualMortgageCost + principalInYear(y)) / upfrontCash * 100 : 0
  const roeY1 = roeYear(1)
  const roeY3 = roeYear(3)
  const roeY5 = roeYear(5)

  // Yield spread & break-even
  const yieldSpread = netYield - interestRate
  const breakEvenRent = annualMortgageCost + serviceCharge

  // Return metrics
  // Cash-on-cash: for cash purchase = net yield; for mortgage = leveraged cash-on-cash
  const displayCashOnCash = mortgageOn ? cashOnCash : netYield

  // IRR
  const irr = price > 0 && rent > 0
    ? buildAndSolveIRR({ price, netIncome, growth, paymentPlan, completion, handoverValue, propertyType })
    : null

  // Gain on paper (off-plan only)
  const gainOnPaper    = propertyType === 'offplan' && handoverValue > 0 ? handoverValue - price : 0
  const gainOnPaperPct = price > 0 && handoverValue > 0 ? (gainOnPaper / price) * 100 : 0

  // Pre-completion ROE (for Gain on Paper hover card)
  const hasHandoverMarked = paymentPlan.some(r => r.handover)
  const noPaymentPlan = paymentPlan.length === 0
  const preHandoverInstalments = hasHandoverMarked
    ? paymentPlan.filter(r => !r.handover).reduce((sum, r) => sum + (r.pct / 100 * price), 0)
    : price
  const acquisitionCosts = dldFee + adminFee + agencyFeeAmt
  const cashDeployedPreCompletion = preHandoverInstalments + acquisitionCosts
  const preCompletionROEDisplay = gainOnPaper > 0 && cashDeployedPreCompletion > 0
    ? (gainOnPaper / cashDeployedPreCompletion) * 100
    : 0

  // Capital growth projection
  const offplanWithHandover = propertyType === 'offplan' && handoverValue > 0
  const growthBase = offplanWithHandover ? handoverValue : price
  // Slot 0 is anchor (handover value or purchase price), slots 1–5 are Yr 1–5 post that anchor
  const projections = [
    { label: offplanWithHandover ? 'At handover' : 'Today', value: growthBase, gain: growthBase - price },
    ...[1, 2, 3, 4, 5].map(y => ({
      label: offplanWithHandover ? `Yr ${y}` : `Year ${y}`,
      value: growthBase * Math.pow(1 + growth / 100, y),
      gain:  growthBase * Math.pow(1 + growth / 100, y) - price,
    })),
  ]

  // Extended return metrics
  const annualCashflow   = mortgageOn ? netIncome - annualMortgageCost : netIncome
  const projValueY5      = growthBase * Math.pow(1 + growth / 100, 5)
  const totalReturnY5    = price > 0 ? netIncome * 5 + (projValueY5 - price) : 0
  const mortgageBalanceY5 = price > 0 && mortgageOn ? Math.max(0, balanceAfterYear(5)) : 0
  const equityY5         = projValueY5 - mortgageBalanceY5

  // Payment plan
  const planTotal    = paymentPlan.reduce((s, r) => s + r.pct, 0)
  const planComplete = Math.abs(planTotal - 100) < 0.01

  const addPlanRow = () => {
    setPlanOpen(true)
    setPaymentPlan(p => [...p, { id: `row-${Date.now()}`, label: '', date: '', pct: 0 }])
  }
  const removePlanRow = (id: string) =>
    setPaymentPlan(p => p.filter(r => r.id !== id))
  const updatePlanRow = (id: string, field: keyof Omit<PlanRow, 'id'>, val: string | number) =>
    setPaymentPlan(p => p.map(r => r.id === id ? { ...r, [field]: val } : r))
  const toggleHandover = (id: string) =>
    setPaymentPlan(p => p.map(r => ({ ...r, handover: r.id === id ? !r.handover : false })))

  // Developer tier lookup — custom-entered names not in list treated as Tier 3
  const developerObj  = DEVELOPERS.find(d => d.name === developer)
  const developerTier = developerObj ? developerObj.tier : (developer ? 3 : null)

  // Investment score — only when key inputs are present
  const hasKeyInputs = price > 0 && rent > 0
  const { score: invScore, grade: invGrade, missingItems: scoreMissing, breakdown: scoreBreakdown } = hasKeyInputs
    ? calculateInvestmentScore({
        netYield, growth, developerTier, paymentPlan,
        propertyType, completion,
        price, handoverValue,
        mortgageOn, interestRate, roeY1, irr,
        hasServiceCharge: scRate > 0,
        dldPct, agencyFeePct, adminFee,
      })
    : { score: 0, grade: '', missingItems: [] as string[], breakdown: { yieldPts: 0, devPts: 0, growthPts: 0, propPts: 0, preCompletionROE: null, irrBonusPts: 0, spread: 0, roeValue: 0, bonuses: [], penalties: [] } as ScoreBreakdown }

  const gradeTextColor: Record<string, string> = {
    A: 'text-green-700', B: 'text-green-600',
    C: 'text-amber-600', D: 'text-orange-600', F: 'text-red-600',
  }
  const gradeBarColor: Record<string, string> = {
    A: 'bg-green-500', B: 'bg-green-400',
    C: 'bg-amber-400', D: 'bg-orange-500', F: 'bg-red-500',
  }

  // Metadata check
  const hasMetadata = project || unit || view || completion

  // Service charge tooltip lines
  const scTooltipLines = [
    `Internal: ${fmt(internalSqft)} sqft × AED ${scRate}/sqft = AED ${fmt(internalSqft * scRate)}`,
    `Balcony: ${fmt(balconySqft)} sqft × AED ${balconyRate.toFixed(2)}/sqft (25% of internal) = AED ${fmt(balconySqft * balconyRate)}`,
    `Total: AED ${fmt(serviceCharge)}`,
  ]

  const editInputBase = 'border border-gray-200 rounded px-2 py-1 text-sm font-medium text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-navy-700 focus:bg-white text-right'

  // Completion date validation
  const completionValid = !completion || /^\d{1,2}\/\d{4}$/.test(completion)

  // ── Save Deal ─────────────────────────────────────────────────────────────

  function openSaveModal() {
    if (!project && price <= 0) {
      setSaveError('Add a price and project name before saving.')
      return
    }
    setSaveError('')
    const parts = [project, unit ? `— ${unit}` : ''].filter(Boolean)
    setSaveName(parts.join(' ').trim() || 'Untitled deal')
    setSaveModalOpen(true)
  }

  function buildDealPayload(name: string) {
    return {
      name,
      params: {
        propertyType, price, rent, growth, internalSqft, balconySqft,
        view, unit, project, completion, developer,
        serviceCharge: scRate, dld: dldPct, agencyFee: agencyFeePct, adminFee,
        handoverValue: handoverValue > 0 ? handoverValue : undefined,
        paymentPlan: JSON.stringify(
          paymentPlan.map(r => ({ label: r.label, date: r.date, pct: r.pct, ...(r.handover ? { handover: true } : {}) }))
        ),
        mortgageOn, depositPct, interestRate, termYears, mortgageType,
      },
      calculatedMetrics: {
        grossYield, netYield,
        netAnnualIncome:      netIncome,
        pricePerSqft,
        totalAcquisitionCost: totalAllIn,
        cashOnCash:           displayCashOnCash,
        irr,
        investmentScore:      invScore,
        grade:                invGrade,
      },
    }
  }

  function showFeedback() {
    setSaveFeedback(true)
    setTimeout(() => setSaveFeedback(false), 2000)
  }

  async function confirmSaveDeal() {
    const name = saveName.trim() || 'Untitled deal'
    const payload = buildDealPayload(name)
    const match = dealsIndex.find(d => d.name.toLowerCase() === name.toLowerCase())

    if (match) {
      setSaveModalOpen(false)
      setDupModal({ existingId: match.id, existingName: match.name, payload })
      return
    }

    const res = await fetch('/api/user/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const { id } = await res.json()
    const savedAt = new Date().toISOString()
    setDealsIndex(prev => [{ id, name, savedAt }, ...prev])
    setSaveModalOpen(false)
    showFeedback()
  }

  async function handleDupOverwrite() {
    if (!dupModal) return
    await fetch(`/api/user/deals/${dupModal.existingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupModal.payload),
    })
    const updatedAt = new Date().toISOString()
    const name = (dupModal.payload as { name: string }).name
    setDealsIndex(prev => prev.map(d =>
      d.id === dupModal.existingId ? { ...d, name, updatedAt } : d
    ))
    setDupModal(null)
    showFeedback()
  }

  async function handleDupSaveAsNew() {
    if (!dupModal) return
    const res = await fetch('/api/user/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dupModal.payload),
    })
    const { id } = await res.json()
    const savedAt = new Date().toISOString()
    const name = (dupModal.payload as { name: string }).name
    setDealsIndex(prev => [{ id, name, savedAt }, ...prev])
    setDupModal(null)
    showFeedback()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#F5F5F2] min-h-screen pb-20">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              {hasMetadata ? (
                <>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                    {project || 'Investment Analysis'}
                    {unit && <span className="text-gray-400 font-normal"> — Unit {unit}</span>}
                  </h1>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 items-center">
                    {internalSqft > 0 && (
                      <span>{fmt(internalSqft)} sqft internal{balconySqft > 0 ? ` + ${fmt(balconySqft)} sqft balcony` : ''}</span>
                    )}
                    {view                                   && <span>{view} view</span>}
                    {completion && propertyType === 'offplan' && <span>Completion {completion}</span>}
                    {propertyType === 'secondary' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Ready now
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Investment Calculator</h1>
              )}
            </div>
            <button
              onClick={handleShare}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Deal
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="flex flex-col md:flex-row md:items-start gap-6">

          {/* ── Left column — inputs (65%) ──────────────────────────────── */}
          <div className="w-full md:w-[65%] space-y-5">

            {/* Property Figures */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="space-y-5">
                <EditableSliderField label="Purchase price (AED)" value={price} min={0} max={15000000} step={50000} prefix="AED" onChange={setPrice} />
                <EditableSliderField label="Annual rent (AED)"    value={rent}  min={0} max={600000}   step={5000}  prefix="AED" onChange={setRent} />
                <Slider label="Capital growth (%/yr)" value={growth} min={0} max={15} step={0.5}
                  displayValue={fmtPct(growth)} onChange={setGrowth} />
                {propertyType === 'offplan' && (
                  <EditableSliderField
                    label="Est. value at handover (AED)"
                    value={handoverValue}
                    min={0} max={15000000} step={50000}
                    prefix="AED"
                    onChange={setHandoverValue}
                  />
                )}
              </div>
            </div>

            {/* Property details + service charge */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setDetailsOpen(v => !v)}
                  className="flex items-center gap-2 text-left"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Property details</p>
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${detailsOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {detailsOpen && (
                  <button
                    onClick={() => setEditingDetails(v => !v)}
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                  >
                    {editingDetails ? 'Done' : 'Edit'}
                  </button>
                )}
              </div>

              <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">

              {/* Property type toggle */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-gray-400">Property type</span>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold">
                  {(['offplan', 'secondary'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPropertyType(t)}
                      className={`px-3 py-1.5 transition-colors ${
                        propertyType === t
                          ? 'bg-navy-700 text-white'
                          : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {t === 'offplan' ? 'Off-plan' : 'Secondary'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text fields: Project, Unit, View, Completion (Completion hidden for secondary) */}
              {(['Project', 'Unit', 'View', 'Completion'] as const)
                .filter(field => !(field === 'Completion' && propertyType === 'secondary'))
                .map((field) => {
                const key = field.toLowerCase() as 'project' | 'unit' | 'view' | 'completion'
                const val = { project, unit, view, completion }[key]
                const setter = { project: setProject, unit: setUnit, view: setView, completion: setCompletion }[key]
                const isCompletion = field === 'Completion'
                return (
                  <div key={field} className="border-t border-gray-50">
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-xs text-gray-400">{field}</span>
                      {editingDetails ? (
                        <input
                          type="text"
                          value={val}
                          onChange={e => setter(e.target.value)}
                          onBlur={e => { if (isCompletion) { const n = normalizeCompletionDate(e.target.value); if (n !== e.target.value) setter(n) } }}
                          placeholder={isCompletion ? 'MM/YYYY e.g. 06/2028' : '—'}
                          className={`w-44 ${editInputBase} ${isCompletion && val && !completionValid ? 'border-red-300 ring-1 ring-red-300' : ''}`}
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-800">{val || '—'}</span>
                      )}
                    </div>
                    {isCompletion && editingDetails && val && !completionValid && (
                      <p className="text-[10px] text-red-500 text-right pb-1">Use MM/YYYY format e.g. 06/2028</p>
                    )}
                  </div>
                )
              })}

              {/* Developer — searchable dropdown */}
              <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                <span className="text-xs text-gray-400">Developer</span>
                {editingDetails ? (
                  <DeveloperDropdown value={developer} onChange={setDeveloper} />
                ) : (
                  <span className="text-sm font-medium text-gray-800">{developer || '—'}</span>
                )}
              </div>

              {/* Number fields: Internal area, Balcony */}
              {([
                { label: 'Internal area',    value: internalSqft, setter: (v: number) => setInternal(v) },
                { label: 'Balcony / terrace', value: balconySqft, setter: (v: number) => setBalcony(v) },
              ]).map(({ label, value, setter }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{label}</span>
                  {editingDetails ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={value === 0 ? '' : value}
                      onChange={e => setter(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      placeholder="0"
                      className={`w-32 ${editInputBase}`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">
                      {value > 0 ? `${fmt(value)} sqft` : '—'}
                    </span>
                  )}
                </div>
              ))}

              {/* Total area — always read-only */}
              <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                <span className="text-xs text-gray-400">Total area</span>
                <span className="text-sm font-medium text-gray-800">
                  {totalSqft > 0 ? `${fmt(totalSqft)} sqft` : '—'}
                </span>
              </div>

              {/* Service charge */}
              <div className="border-t border-gray-100 mt-3 pt-3">
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-gray-400 flex items-center">
                    Annual service charge per sq ft
                    {scRate > 0 && <Tooltip lines={scTooltipLines} />}
                  </span>
                  {editingDetails ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={scInput}
                      onChange={e => {
                        setScInput(e.target.value)
                        const n = parseFloat(e.target.value)
                        if (!isNaN(n) && n >= 0) setScRate(n)
                      }}
                      onBlur={() => {
                        const n = parseFloat(scInput)
                        if (!isNaN(n) && n >= 0) { setScRate(n); setScInput(String(n)) }
                        else { setScInput(scRate > 0 ? String(scRate) : '') }
                      }}
                      placeholder="0"
                      className={`w-32 ${editInputBase}`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">
                      {scRate > 0 ? `AED ${scRate} / sqft` : '—'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                  <span className="text-xs text-gray-400">Total annual service charge</span>
                  <span className="text-sm font-semibold text-green-700">
                    {serviceCharge > 0 ? `AED ${fmt(serviceCharge)}` : '—'}
                  </span>
                </div>
              </div>

              {/* Acquisition costs */}
              <div className="border-t border-gray-100 mt-3 pt-3">

                {/* DLD fee */}
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-xs text-gray-400">DLD fee (%)</span>
                  {editingDetails ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={dldInput}
                      onChange={e => {
                        setDldInput(e.target.value)
                        const n = parseFloat(e.target.value)
                        if (!isNaN(n) && n >= 0) setDldPct(n)
                      }}
                      onBlur={() => {
                        const n = parseFloat(dldInput)
                        if (!isNaN(n) && n >= 0) { setDldPct(n); setDldInput(String(n)) }
                        else { setDldInput(String(dldPct)) }
                      }}
                      placeholder="4"
                      className={`w-32 ${editInputBase}`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">{dldPct}%</span>
                  )}
                </div>
                <div className="flex justify-between items-center pb-1.5 pl-2">
                  <span className="text-xs text-gray-300">↳ AED amount</span>
                  <span className="text-xs text-gray-500 tabular-nums">{price > 0 ? `AED ${fmt(dldFee)}` : '—'}</span>
                </div>

                {/* Agency fee */}
                <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                  <span className="text-xs text-gray-400 flex items-center">
                    Agency fee (%)
                    <Tooltip lines={[
                      'For off-plan purchases the developer typically pays the agency fee.',
                      'For secondary market purchases this is usually 2%.',
                    ]} />
                  </span>
                  {editingDetails ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={agencyFeeInput}
                      onChange={e => {
                        setAgencyFeeInput(e.target.value)
                        const n = parseFloat(e.target.value)
                        if (!isNaN(n) && n >= 0) setAgencyFeePct(n)
                      }}
                      onBlur={() => {
                        const n = parseFloat(agencyFeeInput)
                        if (!isNaN(n) && n >= 0) { setAgencyFeePct(n); setAgencyFeeInput(String(n)) }
                        else { setAgencyFeeInput(agencyFeePct > 0 ? String(agencyFeePct) : '') }
                      }}
                      placeholder="0"
                      className={`w-32 ${editInputBase}`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">
                      {agencyFeePct > 0 ? `${agencyFeePct}%` : '—'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center pb-1.5 pl-2">
                  <span className="text-xs text-gray-300">↳ AED amount</span>
                  <span className="text-xs text-gray-500 tabular-nums">
                    {price > 0 && agencyFeePct > 0 ? `AED ${fmt(agencyFeeAmt)}` : '—'}
                  </span>
                </div>

                {/* Admin / Oqood */}
                <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                  <span className="text-xs text-gray-400">Admin / Oqood (AED)</span>
                  {editingDetails ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={100}
                      value={adminFeeInput}
                      onChange={e => {
                        setAdminFeeInput(e.target.value)
                        const n = parseFloat(e.target.value)
                        if (!isNaN(n) && n >= 0) setAdminFee(n)
                      }}
                      onBlur={() => {
                        const n = parseFloat(adminFeeInput)
                        if (!isNaN(n) && n >= 0) { setAdminFee(n); setAdminFeeInput(String(n)) }
                        else { setAdminFeeInput(adminFee > 0 ? String(adminFee) : '') }
                      }}
                      placeholder="—"
                      className={`w-32 ${editInputBase}`}
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">
                      {adminFee > 0 ? `AED ${fmt(adminFee)}` : '—'}
                    </span>
                  )}
                </div>

                {/* Total acquisition cost */}
                <div className="flex justify-between items-center py-1.5 border-t border-gray-50">
                  <span className="text-xs text-gray-400">Total acquisition cost</span>
                  <span className="text-sm font-bold text-green-700">
                    {price > 0 ? `AED ${fmt(totalAllIn)}` : '—'}
                  </span>
                </div>

              </div>


              </div>{/* end overflow-hidden */}
              </div>{/* end grid collapsible */}

            </div>

            {/* Payment plan — off-plan only */}
            {propertyType === 'offplan' && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <button
                  onClick={() => setPlanOpen(v => !v)}
                  className="w-full flex items-center gap-2 text-left"
                >
                  <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Payment plan</span>
                  {paymentPlan.length > 0 && (
                    <span className="text-[10px] text-gray-400">({paymentPlan.length})</span>
                  )}
                  <svg
                    className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${planOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${planOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                <div className="pt-4">

                {paymentPlan.length > 0 && (
                  <div className="flex h-2.5 rounded-full overflow-hidden mb-4 bg-gray-100">
                    {paymentPlan.map((row, i) => (
                      <div
                        key={row.id}
                        className={`${PLAN_COLORS[i % PLAN_COLORS.length]} transition-all`}
                        style={{ width: `${Math.max(0, Math.min(row.pct, 100))}%` }}
                      />
                    ))}
                  </div>
                )}

                {paymentPlan.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-4">No instalments added yet.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-[16px_1fr_160px_80px_100px_64px_24px] gap-3 items-center px-1">
                      <span />
                      <span className="text-xs text-gray-400">Label</span>
                      <span className="text-xs text-gray-400">Date</span>
                      <span className="text-xs text-gray-400 text-center">%</span>
                      <span className="text-xs text-gray-400 text-right">AED</span>
                      <span className="text-xs text-gray-400 text-center">Handover</span>
                      <span />
                    </div>
                    {paymentPlan.map((row, i) => (
                      <div key={row.id} className={`grid grid-cols-[16px_1fr_160px_80px_100px_64px_24px] gap-3 items-center rounded-lg transition-colors ${row.handover ? 'bg-orange-50 -mx-2 px-2 py-0.5' : ''}`}>
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PLAN_COLORS[i % PLAN_COLORS.length]}`} />
                        <input type="text" value={row.label} placeholder="Label"
                          onChange={e => updatePlanRow(row.id, 'label', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-navy-700 focus:bg-white w-full" />
                        <input type="text" value={row.date} placeholder="Date"
                          onChange={e => updatePlanRow(row.id, 'date', e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-navy-700 focus:bg-white w-full" />
                        <input type="number" value={row.pct === 0 ? '' : row.pct} placeholder="0"
                          min={0} max={100}
                          onChange={e => updatePlanRow(row.id, 'pct', parseFloat(e.target.value) || 0)}
                          className="border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-800 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-navy-700 focus:bg-white text-center w-full" />
                        <span className="text-xs text-gray-500 text-right tabular-nums">
                          {price > 0 ? fmt(price * row.pct / 100) : '—'}
                        </span>
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={!!row.handover}
                            onChange={() => toggleHandover(row.id)}
                            title={row.handover ? 'Remove handover marker' : 'Mark as handover instalment'}
                            className="w-4 h-4 rounded accent-orange-500 cursor-pointer"
                          />
                        </div>
                        <button onClick={() => removePlanRow(row.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-sm font-medium leading-none"
                          aria-label="Remove row">×</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Total:</span>
                    <span className={`text-xs font-semibold ${planComplete ? 'text-green-700' : paymentPlan.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {planTotal.toFixed(1)}%
                      {paymentPlan.length > 0 && !planComplete && ' — must equal 100%'}
                    </span>
                  </div>
                  <button onClick={addPlanRow}
                    className="text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors flex items-center gap-1">
                    <span className="text-base leading-none">+</span> Add instalment
                  </button>
                </div>

                </div>{/* end pt-4 */}
                </div>{/* end overflow-hidden */}
                </div>{/* end grid collapsible */}
              </div>
            )}

            {/* Mortgage toggle + inline inputs */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Mortgage view</p>
                  <p className="text-xs text-gray-400">
                    {mortgageOn ? 'Showing leveraged return metrics' : 'Currently showing cash purchase metrics'}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500">Cash</span>
                  <Toggle on={mortgageOn} onToggle={() => {
                    const newOn = !mortgageOn
                    setMortgageOn(newOn)
                    if (newOn) {
                      const handoverRow = paymentPlan.find(r => r.handover)
                      if (handoverRow) {
                        setDepositPct(Math.min(80, Math.max(20, 100 - handoverRow.pct)))
                      } else {
                        setDepositPct(20)
                      }
                    }
                  }} />
                  <span className="text-xs text-gray-500">Mortgage</span>
                </div>
              </div>

              {mortgageOn && (
                <div className="border-t border-gray-100 p-6">
                  <div className="grid sm:grid-cols-3 gap-6">
                    <Slider label="Deposit"       value={depositPct}   min={20} max={80} step={1}   displayValue={`${depositPct}%  (AED ${fmt(depositAmount)})`} onChange={setDepositPct} />
                    <Slider label="Interest rate" value={interestRate} min={2}  max={8}  step={0.1} displayValue={`${interestRate.toFixed(1)}% p.a.`}            onChange={setInterestRate} />
                    <Slider label="Term"          value={termYears}    min={5}  max={25} step={1}   displayValue={`${termYears} years`}                           onChange={setTermYears} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Monthly payment</p>
                      <p className="text-lg font-bold text-gray-900">AED {fmt(monthlyPayment)}</p>
                    </div>
                    <ROEMetricCard
                      netIncome={netIncome}
                      annualMortgageCost={annualMortgageCost}
                      principalY1={principalInYear(1)}
                      upfrontCash={upfrontCash}
                      depositAmount={depositAmount}
                      dldFee={dldFee}
                      adminFee={adminFee}
                      agencyFeeAmt={agencyFeeAmt}
                      agencyFeePct={agencyFeePct}
                      roeY1={roeY1}
                      roeY3={roeY3}
                      roeY5={roeY5}
                    />
                    <CoCMetricCard
                      netIncome={netIncome}
                      annualMortgageCost={annualMortgageCost}
                      netCashFlow={netCashFlow}
                      upfrontCash={upfrontCash}
                      depositAmount={depositAmount}
                      dldFee={dldFee}
                      adminFee={adminFee}
                      agencyFeeAmt={agencyFeeAmt}
                      agencyFeePct={agencyFeePct}
                      cashOnCash={cashOnCash}
                    />
                  </div>
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500">
                    <div><span className="block font-medium text-gray-700">Loan amount</span>AED {fmt(loanAmount)}</div>
                    <div><span className="block font-medium text-gray-700">Deposit deployed</span>AED {fmt(depositAmount)}</div>
                    <div><span className="block font-medium text-gray-700">Annual debt service</span>AED {fmt(annualMortgageCost)}</div>
                    <div>
                      <span className="block font-medium text-gray-700">Net cash flow / yr</span>
                      <span className={netCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}>
                        AED {netCashFlow >= 0 ? '' : '–'}{fmt(Math.abs(netCashFlow))}
                      </span>
                    </div>
                  </div>
                  <div className={`mt-3 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${yieldSpread >= 0 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                    <span>
                      Net yield {fmtPct(netYield)} vs mortgage rate {fmtPct(interestRate)} — spread: {yieldSpread >= 0 ? '+' : ''}{fmtPct(yieldSpread)}
                    </span>
                    <span className="font-semibold ml-3 flex-shrink-0">
                      {yieldSpread >= 0 ? 'Positively geared' : 'Negatively geared — relying on capital growth.'}
                    </span>
                  </div>
                  <div className="mt-2 px-4 py-2.5 rounded-lg text-xs text-gray-600 bg-gray-50 flex items-center justify-between">
                    <span>Break-even rent</span>
                    <span className="font-semibold tabular-nums">AED {fmt(breakEvenRent)} / yr — minimum rent to cover mortgage payments and service charge.</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Break-even rent = annual debt service + annual service charge. See the{' '}
                    <Link href="/calculators/mortgage" className="underline hover:text-gray-700">standalone mortgage calculator</Link>
                    {' '}for UAE-specific context.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* ── Right column — outputs (35%), sticky on desktop ─────────── */}
          <div className="w-full md:w-[35%] md:sticky md:top-16 md:max-h-[calc(100vh-4rem)] md:overflow-y-auto space-y-5 pb-8">

            {/* Save Deal */}
            <div>
              <button
                onClick={openSaveModal}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  saveFeedback
                    ? 'bg-green-600 text-white'
                    : 'bg-navy-700 hover:bg-navy-600 text-white'
                }`}
              >
                {saveFeedback ? '✓ Deal saved' : 'Save Deal'}
              </button>
              {saveError && <p className="text-xs text-red-500 mt-1.5 text-center">{saveError}</p>}
              <Link
                href="/deals"
                className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all flex items-center justify-center"
              >
                View saved deals →
              </Link>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Gross yield"    value={price > 0 ? fmtPct(grossYield) : '—'} sub="on purchase price"   highlight />
              <MetricCard label="Net yield"      value={price > 0 ? fmtPct(netYield)   : '—'} sub="after service charge" highlight />
              <NetIncomeMetricCard netIncome={netIncome} grossRent={rent} serviceCharge={serviceCharge} />
              <MetricCard label="Price per sqft" value={pricePerSqft > 0 ? fmt(pricePerSqft) : '—'} sub="AED · total area" />
            </div>

            {/* Gain on paper — off-plan only when handover value is set */}
            {propertyType === 'offplan' && handoverValue > 0 && price > 0 && (
              <GainOnPaperCard
                handoverValue={handoverValue}
                price={price}
                gainOnPaper={gainOnPaper}
                gainOnPaperPct={gainOnPaperPct}
                preHandoverInstalments={preHandoverInstalments}
                dldFee={dldFee}
                adminFee={adminFee}
                agencyFeeAmt={agencyFeeAmt}
                agencyFeePct={agencyFeePct}
                cashDeployedPreCompletion={cashDeployedPreCompletion}
                preCompletionROE={preCompletionROEDisplay}
                noPaymentPlan={noPaymentPlan}
              />
            )}

            {/* Investment score */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Investment score</p>
                {hasKeyInputs && scoreMissing.length > 0 && (
                  <>
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <Tooltip lines={scoreMissing} />
                  </>
                )}
              </div>
              {hasKeyInputs ? (
                <>
                  <div className="flex items-end justify-between mb-3">
                    <div>
                      <span className={`text-4xl font-bold ${gradeTextColor[invGrade] ?? 'text-gray-900'}`}>{invScore}</span>
                      <span className="text-sm text-gray-400 ml-1">/ 100</span>
                    </div>
                    <span className={`text-3xl font-bold ${gradeTextColor[invGrade] ?? 'text-gray-900'}`}>{invGrade}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${gradeBarColor[invGrade] ?? 'bg-gray-400'}`} style={{ width: `${invScore}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">Score reflects your inputs and assumptions.</p>

                  {/* Score breakdown toggle */}
                  <button
                    onClick={() => setShowBreakdown(v => !v)}
                    className="mt-3 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    {showBreakdown ? 'Hide breakdown ↑' : 'Show breakdown →'}
                  </button>

                  {showBreakdown && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Base components</p>
                      <div className="flex justify-between">
                        <span>Net yield ({netYield.toFixed(1)}%)</span>
                        <span className="tabular-nums font-medium text-gray-700">{scoreBreakdown.yieldPts.toFixed(1)} / 35</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          Developer ({developer || 'None'}{developerTier ? `, Tier ${developerTier}` : ''})
                        </span>
                        <span className="tabular-nums font-medium text-gray-700">{scoreBreakdown.devPts} / 20</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Capital growth ({growth}%)</span>
                        <span className="tabular-nums font-medium text-gray-700">{scoreBreakdown.growthPts.toFixed(1)} / 15</span>
                      </div>
                      <div className="flex justify-between">
                        <span>
                          {propertyType === 'offplan'
                            ? `Property type (Off-plan${getMonthsToCompletion(completion) !== null ? `, ${getMonthsToCompletion(completion)} mo to completion` : ''})`
                            : 'Property type (Secondary)'}
                        </span>
                        <span className="tabular-nums font-medium text-gray-700">{scoreBreakdown.propPts.toFixed(1)} / 15</span>
                      </div>
                      {scoreBreakdown.bonuses.length > 0 && (
                        <div className="pt-1.5 mt-1.5 border-t border-gray-100">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Bonuses applied</p>
                          {scoreBreakdown.bonuses.map((b, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{b.label}</span>
                              <span className="tabular-nums font-medium text-green-700">+{typeof b.pts === 'number' ? b.pts.toFixed(1).replace(/\.0$/, '') : b.pts}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {scoreBreakdown.penalties.length > 0 && (
                        <div className="pt-1.5 mt-1.5 border-t border-gray-100">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Penalties applied</p>
                          {scoreBreakdown.penalties.map((p, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{p.label}</span>
                              <span className="tabular-nums font-medium text-red-600">{p.pts}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex justify-between pt-1.5 border-t border-gray-100 font-semibold text-gray-700">
                        <span>Total</span>
                        <span className="tabular-nums">{invScore} / 100</span>
                      </div>
                      <p className="text-[10px] text-gray-400 italic mt-1">Temporary — for calibration only.</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">Enter a price and rent to see the investment score.</p>
              )}
            </div>

            {/* Return metrics — collapsible */}
            <div className="bg-white rounded-xl border border-gray-100">
              <button
                onClick={() => setReturnMetricsOpen(v => !v)}
                className="w-full px-6 py-4 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>Return metrics</span>
                <span className="text-gray-400">{returnMetricsOpen ? '▴' : '▾'}</span>
              </button>
              {returnMetricsOpen && (
                <div className="px-6 pb-6 space-y-0 border-t border-gray-50">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-600 flex items-center">
                      Net yield
                      <Tooltip lines={[
                        'Annual rental income after service charge, as a percentage of purchase price.',
                      ]} />
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${hasKeyInputs ? (netYield >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                      {hasKeyInputs ? fmtPct(netYield) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-50">
                    <span className="text-sm text-gray-600 flex items-center">
                      Annual cashflow
                      <Tooltip lines={[
                        'Net rental income after service charge and mortgage payments (if applicable).',
                        'The cash generated by this property each year.',
                      ]} />
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${hasKeyInputs ? (annualCashflow >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                      {hasKeyInputs ? `AED ${fmt(annualCashflow)}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-50">
                    <span className="text-sm text-gray-600 flex items-center">
                      Cash-on-cash return
                      <Tooltip lines={[
                        'Cash-on-Cash measures only the cash that lands in your account each year (rent minus all costs including mortgage payments) as a percentage of cash deployed.',
                        'It ignores principal repayment — the portion of your mortgage payment that builds equity.',
                        'This is why CoC looks modest while ROE tells a more complete story.',
                      ]} />
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${hasKeyInputs ? (displayCashOnCash >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                      {hasKeyInputs ? fmtPct(displayCashOnCash) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-50">
                    <span className="text-sm text-gray-600 flex items-center">
                      IRR (5yr)
                      <Tooltip lines={[
                        'The annualised return that accounts for the timing of every cash flow — when you pay, when you receive rent, and when you sell.',
                        'Accounts for the off-plan payment structure. Assumes exit at Year 5 post-completion.',
                        'If no payment plan is set, models a single upfront purchase at today.',
                      ]} />
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${irr !== null ? (irr >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                      {irr !== null ? fmtPct(irr) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-50">
                    <span className="text-sm text-gray-600 flex items-center">
                      Total return (5yr)
                      <Tooltip lines={[
                        'Combined rental income over 5 years plus projected capital gain at Year 5, based on your capital growth assumption.',
                        'Assumes full occupancy throughout. For illustration only.',
                      ]} />
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${hasKeyInputs ? (totalReturnY5 >= 0 ? 'text-green-700' : 'text-red-600') : 'text-gray-400'}`}>
                      {hasKeyInputs ? `AED ${fmt(totalReturnY5)}` : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Capital growth projection — collapsible */}
            <div className="bg-white rounded-xl border border-gray-100">
              <button
                onClick={() => setCapitalGrowthOpen(v => !v)}
                className="w-full px-6 py-4 flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
              >
                <span>Capital growth projection</span>
                <span className="text-gray-400">{capitalGrowthOpen ? '▴' : '▾'}</span>
              </button>
              {capitalGrowthOpen && (
                <div className="px-6 pb-6 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mt-4 mb-5">
                    At {fmtPct(growth)} annual growth · base {fmt(growthBase)}
                    {offplanWithHandover && ' (from handover value)'} · All values in AED
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {projections.map(({ label, value, gain }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <p className="text-sm font-bold text-gray-900">{growthBase > 0 ? fmt(value) : '—'}</p>
                        {growthBase > 0 && gain !== 0 && (
                          <p className={`text-xs mt-0.5 ${gain >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {gain >= 0 ? '+' : '–'}{fmt(Math.abs(gain))}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                    {offplanWithHandover
                      ? 'Growth projected from estimated handover value. Gain shown vs purchase price. For illustration only.'
                      : 'Growth projected from purchase price. For illustration only.'}
                  </p>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 leading-relaxed px-1 pb-2">
              These calculations are estimates based on the inputs provided and are for informational purposes only.
              They do not constitute financial advice. Actual returns may vary.
            </p>

          </div>

        </div>
      </div>

      {/* Save Deal modal */}
      {saveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onMouseDown={e => { if (e.target === e.currentTarget) setSaveModalOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Save deal</h3>
            <p className="text-xs text-gray-400 mb-4">Edit the name below, then confirm to save.</p>
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter')  confirmSaveDeal()
                if (e.key === 'Escape') setSaveModalOpen(false)
              }}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy-700 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setSaveModalOpen(false)}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveDeal}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-600 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate deal confirmation modal */}
      {dupModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onMouseDown={e => { if (e.target === e.currentTarget) setDupModal(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Duplicate deal name</h3>
            <p className="text-sm text-gray-500 mb-5">
              A deal named <span className="font-semibold text-gray-800">&ldquo;{dupModal.existingName}&rdquo;</span> already exists.
              Do you want to overwrite it or save as a new deal?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDupOverwrite}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-600 transition-colors"
              >
                Overwrite
              </button>
              <button
                onClick={handleDupSaveAsNew}
                className="w-full py-2 rounded-lg text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Save as new
              </button>
              <button
                onClick={() => setDupModal(null)}
                className="w-full py-2 rounded-lg text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
