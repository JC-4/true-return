// Shared pure calculation logic — imported by both the investment calculator and deal analysis page.

export const BALCONY_SC_RATIO = 0.25

export const DEVELOPERS = [
  // ── Tier 1 ─────────────────────────────────────────────────────────────────
  { name: 'Aldar',                  tier: 1 },
  { name: 'Dubai Properties',       tier: 1 },
  { name: 'Eagle Hills',            tier: 1 },
  { name: 'Ellington Properties',   tier: 1 },
  { name: 'Emaar',                  tier: 1 },
  { name: 'Expo City',              tier: 1 },
  { name: 'H&H Development',        tier: 1 },
  { name: 'Majid Al Futtaim',       tier: 1 },
  { name: 'Majid Al Futtaim (MAF)', tier: 1 },  // legacy alias
  { name: 'Meraas',                 tier: 1 },
  { name: 'Modon',                  tier: 1 },
  { name: 'Nakheel',                tier: 1 },
  { name: 'Omniyat',                tier: 1 },
  { name: 'Select Group',           tier: 1 },
  { name: 'Sobha',                  tier: 1 },
  { name: 'Wasl',                   tier: 1 },
  // ── Tier 2 ─────────────────────────────────────────────────────────────────
  { name: 'Arada',                  tier: 2 },
  { name: 'Beyond',                 tier: 2 },
  { name: 'Damac',                  tier: 2 },
  { name: 'Emirates Developments',  tier: 2 },
  { name: 'HRE Development',        tier: 2 },
  { name: 'Iman',                   tier: 2 },
  { name: 'Imtiaz Developments',    tier: 2 },
  { name: 'Imtiaz',                 tier: 2 },  // legacy alias for old Redis deals
  { name: 'Nshama',                 tier: 2 },
  { name: 'ORA Developers',         tier: 2 },
  { name: 'Palma Development',      tier: 2 },
  { name: 'SOL',                    tier: 2 },
  { name: 'Zaya',                   tier: 2 },
  // ── Tier 3 ─────────────────────────────────────────────────────────────────
  { name: 'Avenew Properties',      tier: 3 },
  { name: 'Azizi',                  tier: 3 },
  { name: 'Binghatti',              tier: 3 },
  { name: 'Bloom Living',           tier: 3 },
  { name: 'DAR Global',             tier: 3 },
  { name: 'Deyaar',                 tier: 3 },
  { name: 'HMB Developments',       tier: 3 },
  { name: 'LEOS',                   tier: 3 },
  { name: 'MAG',                    tier: 3 },
  { name: 'Mira Developments',      tier: 3 },
  { name: 'Mirfa',                  tier: 3 },
  { name: 'Mr Eight Development',   tier: 3 },
  { name: 'Prescott',               tier: 3 },
  { name: 'RAK Properties',         tier: 3 },
  { name: 'Samana',                 tier: 3 },
  { name: 'SAAS Properties',        tier: 3 },
  { name: 'Scope Properties',       tier: 3 },
  { name: 'Vision Development',     tier: 3 },
  // ── Tier 4 ─────────────────────────────────────────────────────────────────
  { name: 'Holm',                   tier: 4 },
  { name: 'Meraki',                 tier: 4 },
  { name: 'REEF',                   tier: 4 },
  { name: 'Taraf',                  tier: 4 },
  { name: 'Tiger Properties',       tier: 4 },
  { name: 'Trident',                tier: 4 },
  { name: 'Union Properties',       tier: 4 },
  // ── Tier 5 ─────────────────────────────────────────────────────────────────
  { name: 'Danube',                 tier: 5 },
  { name: 'Object 1',               tier: 5 },
  { name: 'Reportage',              tier: 5 },
]

export const PLAN_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#f97316',
  '#9333ea', '#ec4899', '#2dd4bf', '#f87171',
]

// Tailwind bg-class equivalents of PLAN_COLORS (same palette, different format for className usage)
export const PLAN_COLOR_CLASSES = [
  'bg-blue-500', 'bg-green-500', 'bg-yellow-400', 'bg-orange-500',
  'bg-purple-600', 'bg-pink-500', 'bg-teal-400',  'bg-red-400',
]

export type PlanRow = { id: string; label: string; date: string; pct: number; handover?: boolean }

export type ScoreBreakdown = {
  /** Net yield factor (35 pts max) */
  yieldPts: number
  /** Unleveraged IRR factor (35 pts max) */
  irrPts: number
  /** Developer tier factor (20 pts max) */
  devPts: number
  /** Pre-completion ROE / property type factor (10 pts max) */
  roePts: number
  /** Computed pre-completion ROE %, or null if secondary / no handover value */
  preCompletionROE: number | null
  /** Unleveraged IRR used for scoring (may differ from displayed leveraged IRR) */
  scoringIrr: number | null
}

export type DealMetrics = {
  // Yield
  grossYield: number; netYield: number; netIncome: number; grossRent: number; serviceCharge: number
  pricePerSqft: number
  // Acquisition
  dldFee: number; agencyFeeAmt: number; acquisitionCosts: number; totalAllIn: number
  // Mortgage
  loanAmount: number; depositAmount: number; monthlyPayment: number
  annualMortgageCost: number; upfrontCash: number; netCashFlow: number; cashOnCash: number
  displayCashOnCash: number; annualCashflow: number
  // Returns
  irr: number | null
  gainOnPaper: number; gainOnPaperPct: number
  preCompletionROE: number; cashDeployedPreCompletion: number; preHandoverInstalments: number
  projections: Array<{ label: string; value: number; gain: number }>
  projValueY5: number; totalReturnY5: number
  // Score
  score: number; grade: string
  missingItems: string[]
  breakdown: ScoreBreakdown
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

// Normalise legacy "Q1 2028" → "03/2028" for the stored/displayed value in an input field.
export function normalizeCompletionDate(s: string): string {
  const q = s.trim().match(/^Q([1-4])\s*[\s/]?\s*(\d{4})$/i)
  if (q) {
    const m: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' }
    return `${m[q[1]]}/${q[2]}`
  }
  return s
}

export function parseCompletionDate(s: string): Date | null {
  if (!s) return null
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) {
    const month = parseInt(mmyyyy[1], 10) - 1
    const year  = parseInt(mmyyyy[2], 10)
    if (isNaN(month) || isNaN(year)) return null
    return new Date(year, month, 1)
  }
  const quarter = s.match(/^Q([1-4])\s+(\d{4})$/i)
  if (quarter) {
    const monthMap: Record<string, number> = { '1': 2, '2': 5, '3': 8, '4': 11 }
    return new Date(parseInt(quarter[2], 10), monthMap[quarter[1]], 1)
  }
  return null
}

export function getMonthsToCompletion(s: string): number | null {
  const d = parseCompletionDate(s)
  if (!d) return null
  const now = new Date()
  const months = (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
  return Math.max(0, months)
}

export function getYearsToCompletion(s: string): number | null {
  const months = getMonthsToCompletion(s)
  if (months === null) return null
  return months / 12
}

export function parseDateToYear(dateStr: string, completionYears: number): number {
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

// ─── IRR ─────────────────────────────────────────────────────────────────────

export function solveIRR(cashFlows: number[]): number | null {
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

export function buildAndSolveIRR({
  price, netIncome, growth, paymentPlan, completion, handoverValue, propertyType,
  mortgageOn = false, annualMortgageCost = 0, upfrontCash = 0,
  loanAmount = 0, monthlyPayment = 0, monthlyRate = 0,
}: {
  price: number; netIncome: number; growth: number
  paymentPlan: PlanRow[]; completion: string
  handoverValue: number; propertyType: 'offplan' | 'secondary'
  mortgageOn?: boolean
  annualMortgageCost?: number
  upfrontCash?: number
  loanAmount?: number
  monthlyPayment?: number
  monthlyRate?: number
}): number | null {
  if (price <= 0 || netIncome <= 0) return null

  // Annual cash flow after mortgage (or just netIncome if no mortgage)
  const annualCashflow = mortgageOn ? netIncome - annualMortgageCost : netIncome

  // Remaining loan balance at a given year (0 when no mortgage)
  const balanceAt = (years: number): number => {
    if (!mortgageOn || loanAmount <= 0) return 0
    const months = years * 12
    if (monthlyRate > 0) {
      return Math.max(0, loanAmount * Math.pow(1 + monthlyRate, months)
        - monthlyPayment * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
    }
    return Math.max(0, loanAmount - monthlyPayment * months)
  }

  if (propertyType === 'secondary') {
    const exitYear = 5
    const flows: number[] = new Array(exitYear + 1).fill(0)
    if (mortgageOn) {
      flows[0] -= upfrontCash
      for (let y = 1; y < exitYear; y++) flows[y] += annualCashflow
      const exitValue = price * Math.pow(1 + growth / 100, exitYear)
      flows[exitYear] += annualCashflow + exitValue - balanceAt(exitYear)
    } else {
      flows[0] -= price
      for (let y = 1; y < exitYear; y++) flows[y] += netIncome
      flows[exitYear] += netIncome + price * Math.pow(1 + growth / 100, exitYear)
    }
    return solveIRR(flows)
  }

  const rawYears = getYearsToCompletion(completion)
  const safeCompletionYears = (rawYears === null || isNaN(rawYears) || rawYears < 0) ? 2 : Math.round(rawYears)
  const exitYear = safeCompletionYears + 5
  const flows: number[] = new Array(exitYear + 1).fill(0)

  if (paymentPlan.length > 0) {
    if (mortgageOn && loanAmount > 0) {
      // Acquisition costs are paid upfront (they sit outside the payment plan)
      const acqCosts = upfrontCash - (price - loanAmount)   // upfrontCash − depositAmount
      flows[0] -= acqCosts
      // Mortgage is disbursed at handover — add it as an inflow at that year
      const handoverRow = paymentPlan.find(r => r.handover)
      const handoverYr = handoverRow
        ? Math.min(Math.max(0, Math.round(parseDateToYear(handoverRow.date, safeCompletionYears))), exitYear)
        : safeCompletionYears
      flows[handoverYr] += loanAmount
    }
    for (const row of paymentPlan) {
      const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, safeCompletionYears))), exitYear)
      flows[yr] -= price * row.pct / 100
    }
  } else {
    // No payment plan: deploy upfrontCash (deposit + acq. costs) when mortgaged, else full price
    flows[0] -= mortgageOn ? upfrontCash : price
  }

  for (let y = safeCompletionYears; y < exitYear; y++) flows[y] += annualCashflow

  const exitBase = handoverValue > 0 ? handoverValue : price
  const exitGrowthYears = handoverValue > 0 ? 5 : exitYear
  const exitValue = exitBase * Math.pow(1 + growth / 100, exitGrowthYears)
  // annualCashflow always included for exit year (= netIncome when no mortgage)
  flows[exitYear] += annualCashflow + exitValue - (mortgageOn ? balanceAt(exitYear) : 0)

  return solveIRR(flows)
}

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * Investment scoring system — 4 factors, 100 pts total. No bonuses or penalties.
 *
 * Factor 1 — Net yield     (35 pts max): 35 × (1 − e^(−yield / 5))
 *   Calibrated anchors: 5% ≈ 22, 5.5% ≈ 23, 5.95% ≈ 25, 6.3% ≈ 26, 7% ≈ 27
 *
 * Factor 2 — Unleveraged IRR (35 pts max): 35 × (1 − e^(−irr / 7.5))
 *   Calibrated anchors: 6% ≈ 7, 8% ≈ 18, 8.9% ≈ 21, 10.5% ≈ 27, 12.5% ≈ 33
 *   Always uses mortgageOn: false regardless of actual deal structure.
 *
 * Factor 3 — Developer tier (20 pts max): Tier 1 = 20, Tier 2 = 15, Tier 3 = 10, Tier 4 = 5, Tier 5/null = 0
 *
 * Factor 4 — Pre-completion ROE / property type (10 pts max):
 *   Secondary: flat 10 pts
 *   Off-plan with handoverValue: banded by ROE = (handoverValue − price) / cashDeployedPreCompletion
 *     50%+: 10 | 35–50%: 9 | 20–35%: 8 | 10–20%: 6 | 5–10%: 3 | 0–5%: 1
 *   Off-plan without handoverValue: 0 pts
 *
 * Grade thresholds: A+ ≥ 90, A ≥ 80, B ≥ 70, C ≥ 60, D ≥ 50, F < 50
 */
export function calculateInvestmentScore({
  netYield, developerTier, paymentPlan, propertyType,
  price, handoverValue, scoringIrr, hasServiceCharge,
  dldPct, agencyFeePct, adminFee,
}: {
  netYield: number
  developerTier: number | null
  paymentPlan: PlanRow[]
  propertyType: 'offplan' | 'secondary'
  price: number
  handoverValue: number
  scoringIrr: number | null
  hasServiceCharge: boolean
  dldPct: number
  agencyFeePct: number
  adminFee: number
}): { score: number; grade: string; missingItems: string[]; breakdown: ScoreBreakdown } {

  // Factor 1: Net yield (35 pts max) — exponential curve, k = 4
  const yieldPts = Math.min(35, 35 * (1 - Math.exp(-netYield / 4)))

  // Factor 2: Unleveraged IRR (35 pts max) — exponential curve, k = 7.5
  const irrPts = scoringIrr !== null && scoringIrr > 0
    ? Math.min(35, 35 * (1 - Math.exp(-scoringIrr / 7.5)))
    : 0

  // Factor 3: Developer tier (20 pts max) — categorical slabs
  let devPts = 0  // Tier 5 or unknown/null
  if      (developerTier === 1) devPts = 20
  else if (developerTier === 2) devPts = 15
  else if (developerTier === 3) devPts = 10
  else if (developerTier === 4) devPts =  5

  // Factor 4: Pre-completion ROE / property type (10 pts max)
  const hasPaymentPlan = paymentPlan.length > 0
  const hasHandoverRow = hasPaymentPlan && paymentPlan.some(r => r.handover)
  const preHandoverInstalments = hasHandoverRow
    ? paymentPlan.filter(r => !r.handover).reduce((sum, r) => sum + (r.pct / 100 * price), 0)
    : price
  const acquisitionCosts = (dldPct / 100 * price) + adminFee + (agencyFeePct / 100 * price)
  const cashDeployedPreCompletion = preHandoverInstalments + acquisitionCosts

  let roePts = 0
  let preCompletionROE: number | null = null

  if (propertyType === 'secondary') {
    roePts = 10
  } else if (handoverValue > 0 && price > 0 && cashDeployedPreCompletion > 0) {
    preCompletionROE = ((handoverValue - price) / cashDeployedPreCompletion) * 100
    if      (preCompletionROE >= 50) roePts = 10
    else if (preCompletionROE >= 35) roePts = 9
    else if (preCompletionROE >= 20) roePts = 8
    else if (preCompletionROE >= 10) roePts = 6
    else if (preCompletionROE >= 5)  roePts = 3
    else                             roePts = 1
  }
  // else: off-plan with no handover value → 0 pts

  const total = yieldPts + irrPts + devPts + roePts
  const score = Math.min(100, Math.max(0, Math.round(total)))
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F'

  const missingItems: string[] = []
  if (propertyType === 'offplan' && handoverValue <= 0)    missingItems.push('No handover value entered')
  if (!hasServiceCharge)                                   missingItems.push('No service charge entered')
  if (propertyType === 'offplan' && developerTier === null) missingItems.push('No developer selected')

  return {
    score, grade, missingItems,
    breakdown: { yieldPts, irrPts, devPts, roePts, preCompletionROE, scoringIrr },
  }
}

// ─── Master compute function ──────────────────────────────────────────────────

export function computeDealMetrics(params: {
  propertyType: 'offplan' | 'secondary'
  price: number; rent: number; growth: number
  internalSqft: number; balconySqft: number; scRate: number
  /** When set (townhouse/villa), overrides internalSqft+balconySqft for area-based calcs */
  buaSqft?: number
  completion: string; developer: string; handoverValue: number
  /**
   * Tier sourced directly from Supabase (1 | 2 | 3).
   * When provided and non-null, takes priority over the DEVELOPERS name lookup.
   * Falls back to DEVELOPERS lookup when undefined/null — preserves scoring for
   * old Redis-saved deals that stored the developer as a plain string.
   */
  developerTierOverride?: number | null
  paymentPlan: PlanRow[]
  dldPct: number; agencyFeePct: number; adminFee: number
  mortgageOn: boolean; depositPct: number; interestRate: number
  termYears: number
}): DealMetrics {
  const {
    propertyType, price, rent, growth,
    internalSqft, balconySqft, scRate, buaSqft, completion, developer, handoverValue,
    paymentPlan, dldPct, agencyFeePct, adminFee,
    mortgageOn, depositPct, interestRate, termYears,
  } = params

  // ── Yield & income ────────────────────────────────────────────────────────
  // Callers pass buaSqft only for townhouse/villa (undefined for apartments).
  // Apartment SC: (internalSqft × scRate) + (balconySqft × scRate × 0.25)
  // Townhouse/Villa SC: buaSqft × scRate  (no balcony split)
  const isApartment   = !(buaSqft != null && buaSqft > 0)
  const totalSqft     = isApartment ? internalSqft + balconySqft : buaSqft!
  const balconyRate   = scRate * BALCONY_SC_RATIO
  const serviceCharge = isApartment
    ? (internalSqft * scRate) + (balconySqft * scRate * BALCONY_SC_RATIO)
    : buaSqft! * scRate
  const grossRent    = rent
  const netIncome    = rent - serviceCharge
  const grossYield   = price > 0 ? (rent / price) * 100 : 0
  const netYield     = price > 0 ? (netIncome / price) * 100 : 0
  const pricePerSqft = totalSqft > 0 && price > 0 ? price / totalSqft : 0

  // ── Acquisition costs ─────────────────────────────────────────────────────
  const dldFee        = price * dldPct / 100
  const agencyFeeAmt  = price * agencyFeePct / 100
  const acquisitionCosts = dldFee + agencyFeeAmt + adminFee
  const totalAllIn    = price + acquisitionCosts

  // ── Mortgage ──────────────────────────────────────────────────────────────
  const loanAmount    = price * (1 - depositPct / 100)
  const depositAmount = price * (depositPct / 100)
  const monthlyRate   = interestRate / 100 / 12
  const termMonths    = termYears * 12
  const monthlyPayment = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : loanAmount / termMonths
  const annualMortgageCost = monthlyPayment * 12
  const netCashFlow   = netIncome - annualMortgageCost
  const upfrontCash   = depositAmount + acquisitionCosts
  const cashOnCash    = upfrontCash > 0 ? (netCashFlow / upfrontCash) * 100 : 0
  const displayCashOnCash = mortgageOn ? cashOnCash : netYield
  const annualCashflow = mortgageOn ? netIncome - annualMortgageCost : netIncome

  // ── ROE (for score) ───────────────────────────────────────────────────────
  const balanceAfterYear = (y: number) =>
    monthlyRate > 0
      ? loanAmount * Math.pow(1 + monthlyRate, y * 12) - monthlyPayment * (Math.pow(1 + monthlyRate, y * 12) - 1) / monthlyRate
      : Math.max(0, loanAmount - monthlyPayment * y * 12)
  const principalInYear = (y: number) => {
    const open  = y === 1 ? loanAmount : Math.max(0, balanceAfterYear(y - 1))
    const close = Math.max(0, balanceAfterYear(y))
    return Math.max(0, open - close)
  }
  const roeY1 = upfrontCash > 0 ? (netIncome - annualMortgageCost + principalInYear(1)) / upfrontCash * 100 : 0

  // ── IRR ───────────────────────────────────────────────────────────────────
  const irr = price > 0 && rent > 0
    ? buildAndSolveIRR({
        price, netIncome, growth, paymentPlan, completion, handoverValue, propertyType,
        mortgageOn, annualMortgageCost, upfrontCash,
        loanAmount, monthlyPayment, monthlyRate,
      })
    : null

  // ── Scoring IRR (unleveraged — mortgageOn: false regardless of actual settings) ──
  const scoringIrr = price > 0 && rent > 0
    ? buildAndSolveIRR({
        price, netIncome, growth, paymentPlan, completion, handoverValue, propertyType,
        mortgageOn: false,
      })
    : null

  // ── Gain on paper ─────────────────────────────────────────────────────────
  const gainOnPaper    = propertyType === 'offplan' && handoverValue > 0 ? handoverValue - price : 0
  const gainOnPaperPct = price > 0 && handoverValue > 0 ? (gainOnPaper / price) * 100 : 0
  const hasHandoverMarked = paymentPlan.some(r => r.handover)
  const preHandoverInstalments = hasHandoverMarked
    ? paymentPlan.filter(r => !r.handover).reduce((sum, r) => sum + (r.pct / 100 * price), 0)
    : price
  const cashDeployedPreCompletion = preHandoverInstalments + acquisitionCosts
  const preCompletionROE = gainOnPaper > 0 && cashDeployedPreCompletion > 0
    ? (gainOnPaper / cashDeployedPreCompletion) * 100
    : 0

  // ── Projections ───────────────────────────────────────────────────────────
  const offplanWithHandover = propertyType === 'offplan' && handoverValue > 0
  const growthBase = offplanWithHandover ? handoverValue : price
  const projections = [
    { label: offplanWithHandover ? 'At handover' : 'Today', value: growthBase, gain: growthBase - price },
    ...[1, 2, 3, 4, 5].map(y => ({
      label: offplanWithHandover ? `Yr ${y}` : `Year ${y}`,
      value: growthBase * Math.pow(1 + growth / 100, y),
      gain:  growthBase * Math.pow(1 + growth / 100, y) - price,
    })),
  ]
  const projValueY5   = growthBase * Math.pow(1 + growth / 100, 5)
  const totalReturnY5 = price > 0 ? netIncome * 5 + (projValueY5 - price) : 0

  // ── Score ─────────────────────────────────────────────────────────────────
  // Prefer the Supabase tier when available; fall back to the hardcoded name
  // lookup for backward compat with old Redis-saved deals.
  const developerTier: number | null =
    (params.developerTierOverride != null)
      ? params.developerTierOverride
      : developer
        ? (DEVELOPERS.find(d => d.name === developer)?.tier ?? null)
        : null

  const { score, grade, missingItems, breakdown } = calculateInvestmentScore({
    netYield, developerTier, paymentPlan, propertyType,
    price, handoverValue, scoringIrr,
    hasServiceCharge: scRate > 0,
    dldPct, agencyFeePct, adminFee,
  })

  return {
    grossYield, netYield, netIncome, grossRent, serviceCharge, pricePerSqft,
    dldFee, agencyFeeAmt, acquisitionCosts, totalAllIn,
    loanAmount, depositAmount, monthlyPayment, annualMortgageCost,
    upfrontCash, netCashFlow, cashOnCash, displayCashOnCash, annualCashflow,
    irr, gainOnPaper, gainOnPaperPct, preCompletionROE,
    cashDeployedPreCompletion, preHandoverInstalments,
    projections, projValueY5, totalReturnY5,
    score, grade, missingItems, breakdown,
  }
}
