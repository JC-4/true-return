// Shared pure calculation logic — imported by both the investment calculator and deal analysis page.

export const BALCONY_SC_RATIO = 0.25

export const DEVELOPERS = [
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
  { name: 'Scope Properties',       tier: 2 },
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

export const PLAN_COLORS = [
  '#3b82f6', '#22c55e', '#eab308', '#f97316',
  '#9333ea', '#ec4899', '#2dd4bf', '#f87171',
]

export type PlanRow = { id: string; label: string; date: string; pct: number; handover?: boolean }

export type ScoreBreakdown = {
  yieldPts: number; devPts: number; growthPts: number; propPts: number
  preCompletionROE: number | null
  irrBonusPts: number
  spread: number
  roeValue: number
  bonuses: Array<{ label: string; pts: number }>
  penalties: Array<{ label: string; pts: number }>
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

export function calculateInvestmentScore({
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
  const yieldPts  = Math.min(35, 35 * (1 - Math.exp(-netYield / 3.5)))
  let   devPts    = 8
  if      (developerTier === 1) devPts = 20
  else if (developerTier === 2) devPts = 14
  const growthPts = Math.min(15, 15 * (1 - Math.exp(-growth / 4)))

  const completionMonths = getMonthsToCompletion(completion) ?? null
  let propPts = 0
  if (propertyType === 'secondary') {
    propPts = 15
  } else {
    if      (completionMonths === null)    propPts = 6
    else if (completionMonths <= 12)       propPts = 15
    else if (completionMonths <= 24)       propPts = 12
    else if (completionMonths <= 36)       propPts = 8
    else if (completionMonths <= 48)       propPts = 4
    else                                   propPts = 2
  }

  let total = yieldPts + devPts + growthPts + propPts
  const bonuses: ScoreBreakdown['bonuses'] = []

  const hasPaymentPlan = paymentPlan.length > 0
  const hasHandoverRow = hasPaymentPlan && paymentPlan.some(r => r.handover)
  const preHandoverInstalments = hasHandoverRow
    ? paymentPlan.filter(r => !r.handover).reduce((sum, r) => sum + (r.pct / 100 * price), 0)
    : price
  const acquisitionCosts = (dldPct / 100 * price) + adminFee + (agencyFeePct / 100 * price)
  const cashDeployedPreCompletion = preHandoverInstalments + acquisitionCosts
  let preCompletionROE: number | null = null
  if (propertyType === 'offplan' && handoverValue > price && price > 0 && acquisitionCosts > 0 && cashDeployedPreCompletion > 0) {
    preCompletionROE = ((handoverValue - price) / cashDeployedPreCompletion) * 100
    const gainBonus = Math.min(20, 20 * (1 - Math.exp(-preCompletionROE / 25)))
    if (gainBonus > 0.05) { total += gainBonus; bonuses.push({ label: `Pre-completion ROE (${preCompletionROE.toFixed(1)}%)`, pts: Math.round(gainBonus * 10) / 10 }) }
  }

  let irrBonusPts = 0
  if (irr !== null && irr > 0) {
    irrBonusPts = Math.min(6, 6 * (1 - Math.exp(-irr / 8)))
    if (irrBonusPts > 0.05) { total += irrBonusPts; bonuses.push({ label: `IRR bonus (${irr.toFixed(1)}%)`, pts: Math.round(irrBonusPts * 10) / 10 }) }
  }

  const spread = netYield - interestRate
  let gearingBonus = 0
  if (mortgageOn) {
    if      (spread >= 1.5) gearingBonus = 5
    else if (spread >= 0.5) gearingBonus = 2
    if (gearingBonus > 0) { total += gearingBonus; bonuses.push({ label: `Positive gearing (spread ${spread.toFixed(1)}%)`, pts: gearingBonus }) }
  }

  let roeBonusPts = 0
  if (mortgageOn && roeY1 > 0) {
    roeBonusPts = Math.min(5, 5 * (1 - Math.exp(-roeY1 / 6)))
    if (roeBonusPts > 0.05) { total += roeBonusPts; bonuses.push({ label: `Strong ROE (${roeY1.toFixed(1)}%)`, pts: Math.round(roeBonusPts * 10) / 10 }) }
  }

  if (propertyType === 'offplan' && developerTier === 1 && completionMonths !== null && completionMonths <= 24) {
    total += 2; bonuses.push({ label: 'Low completion risk', pts: 2 })
  }

  const penalties: ScoreBreakdown['penalties'] = []
  if (mortgageOn && netYield < interestRate)                                                             { total -= 5; penalties.push({ label: 'Negative gearing', pts: -5 }) }
  if (propertyType === 'offplan' && developerTier === 3 && completionMonths !== null && completionMonths > 36) { total -= 8; penalties.push({ label: 'High-risk off-plan', pts: -8 }) }
  if (propertyType === 'offplan' && completionMonths !== null && completionMonths > 48)                  { total -= 3; penalties.push({ label: 'Very long completion', pts: -3 }) }

  const score = Math.min(100, Math.max(0, Math.round(total)))
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F'

  const missingItems: string[] = []
  if (propertyType === 'offplan' && handoverValue <= 0)     missingItems.push('No handover value entered')
  if (propertyType === 'offplan' && !completion)             missingItems.push('No completion date entered')
  if (propertyType === 'offplan' && !hasPaymentPlan)         missingItems.push('No payment plan entered')
  if (!hasServiceCharge)                                     missingItems.push('No service charge entered')
  if (propertyType === 'offplan' && developerTier === null)  missingItems.push('No developer selected')

  return {
    score, grade, missingItems,
    breakdown: { yieldPts, devPts, growthPts, propPts, preCompletionROE, irrBonusPts, spread, roeValue: roeY1, bonuses, penalties },
  }
}

// ─── Master compute function ──────────────────────────────────────────────────

export function computeDealMetrics(params: {
  propertyType: 'offplan' | 'secondary'
  price: number; rent: number; growth: number
  internalSqft: number; balconySqft: number; scRate: number
  completion: string; developer: string; handoverValue: number
  paymentPlan: PlanRow[]
  dldPct: number; agencyFeePct: number; adminFee: number
  mortgageOn: boolean; depositPct: number; interestRate: number
  termYears: number
}): DealMetrics {
  const {
    propertyType, price, rent, growth,
    internalSqft, balconySqft, scRate, completion, developer, handoverValue,
    paymentPlan, dldPct, agencyFeePct, adminFee,
    mortgageOn, depositPct, interestRate, termYears,
  } = params

  // ── Yield & income ────────────────────────────────────────────────────────
  const balconyRate  = scRate * BALCONY_SC_RATIO
  const serviceCharge = internalSqft * scRate + balconySqft * balconyRate
  const grossRent    = rent
  const netIncome    = rent - serviceCharge
  const totalSqft    = internalSqft + balconySqft
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
  const developerTier = developer
    ? (DEVELOPERS.find(d => d.name === developer)?.tier ?? null)
    : null

  const { score, grade, missingItems, breakdown } = calculateInvestmentScore({
    netYield, growth, developerTier, paymentPlan, propertyType, completion,
    price, handoverValue,
    mortgageOn, interestRate, roeY1, irr,
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
