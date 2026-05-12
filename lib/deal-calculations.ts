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

  const rawYears = getYearsToCompletion(completion)
  const safeCompletionYears = (rawYears === null || isNaN(rawYears) || rawYears < 0) ? 2 : Math.round(rawYears)
  const exitYear = safeCompletionYears + 5
  const flows: number[] = new Array(exitYear + 1).fill(0)

  if (paymentPlan.length > 0) {
    for (const row of paymentPlan) {
      const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, safeCompletionYears))), exitYear)
      flows[yr] -= price * row.pct / 100
    }
  } else {
    flows[0] -= price
  }

  for (let y = safeCompletionYears; y < exitYear; y++) flows[y] += netIncome

  const exitBase = handoverValue > 0 ? handoverValue : price
  const exitGrowthYears = handoverValue > 0 ? 5 : exitYear
  flows[exitYear] += exitBase * Math.pow(1 + growth / 100, exitGrowthYears)

  return solveIRR(flows)
}

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
