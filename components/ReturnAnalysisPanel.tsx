'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Project, ShortlistAssumptions } from '@/lib/types'
import { solveIRR, getYearsToCompletion, parseDateToYear, buildAndSolveIRR, computeDealMetrics, DLD_PCT, ADMIN_FEE } from '@/lib/calculations'
import { adaptPaymentPlan, formatHandoverDate } from '@/lib/payment-plan'
import { resolveReturnInputs, snapToBounds } from '@/lib/return-defaults'
import { Tooltip, SecondaryPillNav } from '@/components/SharedUI'

export default function ReturnAnalysisPanel({
  project,
  showFullAnalysis,
  assumptions,
  defaultUnitTypeId,
  purchasePrice,
}: {
  project: Project
  showFullAnalysis: boolean
  /** Stored per-client figures (shortlist); clamped to the selected unit's slider bounds on load */
  assumptions?: ShortlistAssumptions | null
  /** Unit to preselect, taking priority over the featured/median default */
  defaultUnitTypeId?: string | null
  /** Price to analyse for the seeded unit; null falls back to its price_from */
  purchasePrice?: number | null
}) {
  const unitTypes = [...(project.unit_types ?? [])].sort((a, b) => {
    if (a.bedrooms === null) return 1
    if (b.bedrooms === null) return -1
    return a.bedrooms - b.bedrooms
  })
  const scRate    = project.service_charge_rate ?? 0
  const planRows  = adaptPaymentPlan(project.payment_plans, project.handover_date)
  const completionStr = formatHandoverDate(project.handover_date)

  // ── Unit / bedroom selector ────────────────────────────────────────────────
  const bedroomGroups = [...new Set(unitTypes.map(ut => ut.bedrooms))].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return a - b
  })
  const residentialUnits = unitTypes.filter(ut => ut.bedrooms !== null)
  const poolForDefault   = residentialUnits.length > 0 ? residentialUnits : unitTypes
  const sortedByPrice    = [...poolForDefault].sort((a, b) => (a.price_from ?? 0) - (b.price_from ?? 0))
  // An explicitly seeded unit wins; otherwise prefer a featured unit (cheapest
  // if several are flagged); fall back to the median by price
  const featuredUnits    = sortedByPrice.filter(ut => ut.is_featured)
  const seededUnit       = defaultUnitTypeId ? unitTypes.find(ut => ut.id === defaultUnitTypeId) : undefined
  const defaultUnit      = seededUnit ?? featuredUnits[0] ?? sortedByPrice[Math.floor(sortedByPrice.length / 2)] ?? sortedByPrice[0]
  // Use !== undefined so bedrooms=null (commercial units) is preserved rather than falling through ??
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | null>(
    defaultUnit !== undefined ? defaultUnit.bedrooms : (bedroomGroups[0] ?? null)
  )
  const unitsInGroup = unitTypes.filter(ut => ut.bedrooms === selectedBedrooms)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(defaultUnit?.id ?? unitsInGroup[0]?.id ?? '')
  const selectedUnit = unitTypes.find(ut => ut.id === selectedUnitId) ?? unitsInGroup[0]

  const internalSqft = selectedUnit?.internal_sqft ?? 0
  const balconySqft  = selectedUnit?.balcony_sqft  ?? 0

  // The entry's purchase price was chosen for one unit; any other unit is
  // analysed at its own price_from.
  function purchasePriceFor(unitId: string | undefined) {
    return unitId && unitId === defaultUnitTypeId ? purchasePrice : null
  }

  // Everything the panel loads with comes from one shared derivation in
  // lib/return-defaults.ts, so the shortlist comparison cannot disagree with it.
  const [initial] = useState(() => resolveReturnInputs({
    unit: selectedUnit,
    fallbackPrice: project.starting_price,
    purchasePrice: purchasePriceFor(selectedUnit?.id),
    assumptions,
  }))

  const [price,         setPrice]         = useState(initial.price)
  const [rent,          setRent]          = useState(initial.rent)
  const [handoverValue, setHandoverValue] = useState(initial.handoverValue)
  const [growth,        setGrowth]        = useState(initial.growth)
  const [holdPeriod,    setHoldPeriod]    = useState(initial.holdPeriod)

  // Bounds are fixed at load and on unit change. Rent and handover value don't
  // move with price, so nothing needs to recompute them in between.
  const [priceBounds, setPriceBounds] = useState(initial.priceBounds)
  const [rentBounds,  setRentBounds]  = useState(initial.rentBounds)
  const [hvBounds,    setHvBounds]    = useState(initial.hvBounds)

  // Everything downstream calculates from the price being analysed
  const basePrice = price

  // Price moves alone: rent and handover value are the client's own inputs and
  // are left untouched, so raising price puts more capital in against the same
  // income and yield and IRR fall accordingly.
  function handlePriceChange(raw: number) {
    // The track starts at price_from, which is rarely a multiple of the step,
    // so snap dragged values to clean figures. The loaded price is left exactly
    // as configured, so it still matches the comparison table.
    setPrice(snapToBounds(raw, priceBounds))
  }

  // Both effects below reset state derived from the current selection, so they
  // must fire only on an actual change. Effects also run after first render
  // (twice in strict mode), where resetting would silently overwrite seeded
  // assumptions — guard with the previous value, not a first-run flag.
  const prevUnitIdRef = useRef(selectedUnitId)
  useEffect(() => {
    if (prevUnitIdRef.current === selectedUnitId) return
    prevUnitIdRef.current = selectedUnitId
    const unit = unitTypes.find(ut => ut.id === selectedUnitId)
    if (!unit) return
    // Stored assumptions belong to the seeded unit, so they are not carried over
    const next = resolveReturnInputs({
      unit,
      fallbackPrice: project.starting_price,
      purchasePrice: purchasePriceFor(unit.id),
    })
    setPrice(next.price)
    setRent(next.rent)
    setHandoverValue(next.handoverValue)
    setPriceBounds(next.priceBounds)
    setRentBounds(next.rentBounds)
    setHvBounds(next.hvBounds)
  }, [selectedUnitId]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevBedroomsRef = useRef(selectedBedrooms)
  useEffect(() => {
    if (prevBedroomsRef.current === selectedBedrooms) return
    prevBedroomsRef.current = selectedBedrooms
    const first = unitTypes.find(ut => ut.bedrooms === selectedBedrooms)
    if (first) setSelectedUnitId(first.id)
  }, [selectedBedrooms]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mobile scroll refs ────────────────────────────────────────────────────
  const scenarioScrollRef = useRef<HTMLDivElement | null>(null)
  const exitScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scenarioScrollRef.current
    if (!el) return
    const card = el.children[1] as HTMLElement
    if (card) el.scrollLeft = card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2
  }, [])

  // ── Financing state ────────────────────────────────────────────────────────
  const [financing,    setFinancing]    = useState<'cash' | 'mortgage'>(assumptions?.financing ?? 'cash')
  const handoverRow = planRows.find(r => r.handover) ?? planRows[planRows.length - 1]
  const defaultLtv  = handoverRow
    ? Math.min(80, Math.max(20, Math.round(handoverRow.pct / 5) * 5))
    : 80
  const [ltvPct,       setLtvPct]       = useState(assumptions?.ltvPct ?? defaultLtv)
  const [mortgageRate, setMortgageRate] = useState(assumptions?.mortgageRate ?? 4.5)
  const mortgageOn = financing === 'mortgage'

  // ── Core metrics via computeDealMetrics ────────────────────────────────────
  const metrics = basePrice > 0 ? computeDealMetrics({
    propertyType: 'offplan',
    price:        basePrice,
    rent,
    growth,
    internalSqft,
    balconySqft,
    scRate,
    completion:   completionStr,
    developer:    project.developer?.name ?? '',
    handoverValue,
    paymentPlan:  planRows,
    dldPct:       DLD_PCT,
    agencyFeePct: 0,
    adminFee:     ADMIN_FEE,
    mortgageOn,
    depositPct:   100 - ltvPct,
    interestRate: mortgageRate,
    termYears:    25,
  }) : null

  // ── Derived ────────────────────────────────────────────────────────────────
  const serviceCharge = metrics?.serviceCharge ?? (internalSqft * scRate) + (balconySqft * scRate * 0.25)
  const netIncome     = rent - serviceCharge
  const rawCompYears  = getYearsToCompletion(completionStr)
  const compYears     = Math.max(0, Math.round(rawCompYears ?? 2))

  // ── Payment plan year grouping ─────────────────────────────────────────────
  type YG = { pct: number; aed: number; label: string; isHandover: boolean }
  const ygMap = new Map<string, YG>()
  for (const row of planRows) {
    const yr  = Math.max(0, Math.round(parseDateToYear(row.date, compYears)))
    const key = row.handover ? 'handover' : `yr-${yr}`
    const lbl = row.handover
      ? `Handover (${formatHandoverDate(project.handover_date)})`
      : yr === 0 ? 'Year 0 (now)' : `Year ${yr}`
    const prev = ygMap.get(key)
    const newPct = (prev?.pct ?? 0) + row.pct
    ygMap.set(key, { pct: newPct, aed: (newPct / 100) * basePrice, label: prev?.label ?? lbl, isHandover: !!(row.handover) })
  }
  const yearGroups = [...ygMap.entries()]
    .sort(([a], [b]) => {
      if (a === 'handover') return 1
      if (b === 'handover') return -1
      return parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
    })
    .map(([, v]) => v)

  // Year-5 IRR via buildAndSolveIRR (unleveraged — matches main deal calculator)
  const year5BaseIRR = basePrice > 0 && netIncome > 0 ? buildAndSolveIRR({
    price: basePrice, netIncome, growth, paymentPlan: planRows,
    completion: completionStr, handoverValue, propertyType: 'offplan',
  }) : null

  // ── Exit scenario builder ──────────────────────────────────────────────────
  function buildExitResult(holdYrs: number) {
    const hv = handoverValue > 0 ? handoverValue : basePrice
    if (holdYrs === 0) {
      const n = Math.max(compYears, 1)
      const flows: number[] = new Array(n + 1).fill(0)
      if (planRows.length > 0) {
        for (const row of planRows) {
          const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), n)
          flows[yr] -= basePrice * row.pct / 100
        }
      } else {
        flows[0] -= basePrice
      }
      flows[n] += hv
      return { irr: basePrice > 0 ? solveIRR(flows) : null, exitValue: hv, totalReturn: hv - basePrice, capitalGain: hv - basePrice }
    }
    const exitYr = compYears + holdYrs
    const flows: number[] = new Array(exitYr + 1).fill(0)
    if (planRows.length > 0) {
      for (const row of planRows) {
        const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYr)
        flows[yr] -= basePrice * row.pct / 100
      }
    } else {
      flows[0] -= basePrice
    }
    for (let y = compYears; y < exitYr; y++) flows[y] += netIncome
    const exitValue   = hv * Math.pow(1 + growth / 100, holdYrs)
    const capitalGain = exitValue - basePrice
    const totalReturn = capitalGain + netIncome * holdYrs
    flows[exitYr] += netIncome + exitValue
    return { irr: basePrice > 0 ? solveIRR(flows) : null, exitValue, totalReturn, capitalGain }
  }

  const exitScenarios = [
    { label: 'At handover', holdYrs: 0 },
    { label: 'Year 3',      holdYrs: 3 },
    { label: 'Year 5',      holdYrs: 5 },
    { label: 'Year 10',     holdYrs: 10 },
  ].map(s => {
    const result = buildExitResult(s.holdYrs)
    // Year 5 uses buildAndSolveIRR to match the main deal calculator
    const irr = s.holdYrs === 5 ? year5BaseIRR : result.irr
    return { ...s, ...result, irr }
  })

  // ── Gain on paper ──────────────────────────────────────────────────────────
  const gainOnPaper    = metrics?.gainOnPaper    ?? (handoverValue > basePrice ? handoverValue - basePrice : 0)
  const gainOnPaperPct = metrics?.gainOnPaperPct ?? (basePrice > 0 ? (gainOnPaper / basePrice) * 100 : 0)
  const handoverIRR    = exitScenarios[0].irr

  useEffect(() => {
    const el = exitScrollRef.current
    if (!el) return
    const activeIdx = exitScenarios.findIndex(s => s.holdYrs === holdPeriod)
    const card = el.children[activeIdx] as HTMLElement
    if (card) el.scrollLeft = card.offsetLeft - el.offsetWidth / 2 + card.offsetWidth / 2
  }, [holdPeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  const preHandoverPct     = planRows.filter(r => !r.handover).reduce((s, r) => s + r.pct, 0)
  const totalPaidBeforeHO  = (preHandoverPct / 100) * basePrice
  const returnOnEquity     = totalPaidBeforeHO > 0 ? (gainOnPaper / totalPaidBeforeHO) * 100 : null

  // ── Financing card details ─────────────────────────────────────────────────
  const dldFee             = basePrice * 0.04
  const adminFee           = 4_200
  const firstSlab          = planRows[0]
  const remainingInstals   = planRows.slice(1)
  const dueAtBooking       = (firstSlab ? (firstSlab.pct / 100) * basePrice : 0) + dldFee + adminFee

  const loanAmount         = metrics?.loanAmount         ?? 0
  const monthlyPayment     = metrics?.monthlyPayment     ?? 0
  const annualMortgageCost = metrics?.annualMortgageCost ?? 0
  const totalInterest      = monthlyPayment * 25 * 12 - loanAmount
  const netMonthly         = Math.round(rent / 12 - serviceCharge / 12 - monthlyPayment)

  const mRate = mortgageRate / 100 / 12
  function balanceAt(years: number): number {
    if (loanAmount <= 0) return 0
    const months = years * 12
    if (mRate > 0) {
      return Math.max(0, loanAmount * Math.pow(1 + mRate, months)
        - monthlyPayment * (Math.pow(1 + mRate, months) - 1) / mRate)
    }
    return Math.max(0, loanAmount - monthlyPayment * months)
  }

  const hv0 = handoverValue > 0 ? handoverValue : basePrice
  const equityRows = [
    { label: 'Now',                    propValue: basePrice,                             loanBal: loanAmount },
    { label: `Handover (+${compYears}yr)`, propValue: hv0,                              loanBal: balanceAt(compYears) },
    { label: '+3yr post-handover',     propValue: hv0 * Math.pow(1 + growth / 100, 3),  loanBal: balanceAt(compYears + 3) },
    { label: '+5yr post-handover',     propValue: hv0 * Math.pow(1 + growth / 100, 5),  loanBal: balanceAt(compYears + 5) },
    { label: '+10yr post-handover',    propValue: hv0 * Math.pow(1 + growth / 100, 10), loanBal: balanceAt(compYears + 10) },
  ].map(r => ({ ...r, equity: r.propValue - r.loanBal }))

  // ── Break-even ────────────────────────────────────────────────────────────
  const minRent = serviceCharge + (mortgageOn ? annualMortgageCost : 0)

  function findGrowthFor8PctIRR(): number | null {
    const hYrs = holdPeriod > 0 ? holdPeriod : 5
    if (basePrice <= 0) return null
    let lo = 0, hi = 30
    let converged = false
    for (let i = 0; i < 60; i++) {
      const mid    = (lo + hi) / 2
      const exitYr = compYears + hYrs
      const flows: number[] = new Array(exitYr + 1).fill(0)
      if (planRows.length > 0) {
        for (const row of planRows) {
          const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYr)
          flows[yr] -= basePrice * row.pct / 100
        }
      } else {
        flows[0] -= basePrice
      }
      for (let y = compYears; y < exitYr; y++) flows[y] += netIncome
      const hv = handoverValue > 0 ? handoverValue : basePrice
      const ev = hv * Math.pow(1 + mid / 100, hYrs)
      flows[exitYr] += netIncome + ev
      const irr = solveIRR(flows)
      if (irr === null) { lo = mid; continue }
      if (irr < 8) lo = mid; else hi = mid
      if (hi - lo < 0.02) { converged = true; break }
    }
    return converged && hi < 29.9 ? hi : null
  }

  const growthFor8PctIRR = findGrowthFor8PctIRR()

  // ── Scenario computation (Conservative / Base / Optimistic) ─────────────────
  type ScenarioResult =
    | { mode: 'flip'; netYield: number; gainOnPaper: number; scenarioHV: number; returnOnCapital: number }
    | { mode: 'hold'; netYield: number; irr: number | null; valueAtExit: number; totalReturn: number }

  function computeScenario(rentMult: number, growthMult: number, hvMult = 1.0): ScenarioResult {
    const sRent      = rent * rentMult
    const sGrowth    = growth * growthMult
    const sHV        = handoverValue * hvMult
    const sNetIncome = sRent - serviceCharge
    const sNetYield  = basePrice > 0 ? (sNetIncome / basePrice) * 100 : 0

    if (holdPeriod === 0) {
      const gainOnPaper      = sHV - basePrice
      const totalDeployed    = basePrice + dldFee + adminFee
      const returnOnCapital  = totalDeployed > 0 ? (gainOnPaper / totalDeployed) * 100 : 0
      return { mode: 'flip', netYield: sNetYield, gainOnPaper, scenarioHV: sHV, returnOnCapital }
    }

    const exitYear = compYears + holdPeriod
    const flows: number[] = new Array(exitYear + 1).fill(0)
    if (planRows.length > 0) {
      for (const row of planRows) {
        const yr = Math.min(Math.max(0, Math.round(parseDateToYear(row.date, compYears))), exitYear)
        flows[yr] -= basePrice * row.pct / 100
      }
    } else {
      flows[0] -= basePrice
    }
    for (let y = compYears; y < exitYear; y++) flows[y] += sNetIncome
    const exitBase  = sHV > 0 ? sHV : basePrice
    const exitValue = exitBase * Math.pow(1 + sGrowth / 100, holdPeriod)
    flows[exitYear] += sNetIncome + exitValue

    const irr         = solveIRR(flows)
    const totalReturn = sNetIncome * holdPeriod + (exitValue - basePrice)
    return { mode: 'hold', netYield: sNetYield, irr, valueAtExit: exitValue, totalReturn }
  }

  const conservative = holdPeriod === 0 ? computeScenario(1,    1,    0.925) : computeScenario(0.85, 0.85)
  const base         =                    computeScenario(1,    1,    1)
  const optimistic   = holdPeriod === 0 ? computeScenario(1,    1,    1.075) : computeScenario(1.15, 1.15)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtA(n: number): string {
    const abs  = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    return `${sign}AED ${Math.round(abs).toLocaleString()}`
  }
  function fmtP(n: number | null): string {
    if (n === null) return '—'
    return `${n.toFixed(1)}%`
  }
  function bedroomLabel(b: number | null) {
    if (b === null) return 'Commercial'
    if (b === 0)    return 'Studio'
    return `${b} Bed`
  }

  const SPILL_ON  = 'px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border flex flex-col items-center leading-none border-brand-bronze text-white'
  const SPILL_OFF = 'px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-colors border flex flex-col items-center leading-none bg-brand-surface border-brand-border text-brand-muted hover:text-brand-text'

  // Lowest price per bedroom group, for display in each group pill
  const minPriceByGroup = new Map<number | null, number | null>()
  for (const b of bedroomGroups) {
    const prices = unitTypes.filter(ut => ut.bedrooms === b).map(ut => ut.price_from).filter((p): p is number => p !== null)
    minPriceByGroup.set(b, prices.length > 0 ? Math.min(...prices) : null)
  }
  const minSqftByGroup = new Map<number | null, number | null>()
  for (const b of bedroomGroups) {
    const sqfts = unitTypes.filter(ut => ut.bedrooms === b).map(ut => ut.internal_sqft).filter((s): s is number => s != null)
    minSqftByGroup.set(b, sqfts.length > 0 ? Math.min(...sqfts) : null)
  }

  if (unitTypes.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-brand-hint">No unit types have been added to this project yet.</p>
      </div>
    )
  }

  const secondaryNavSections = [
    { id: 'inputs',        label: 'Inputs' },
    { id: 'scenarios',     label: 'Scenarios',     locked: !showFullAnalysis },
    { id: 'financing',     label: 'Financing',     locked: !showFullAnalysis, color: '#C9A96E' },
    { id: 'exit-analysis', label: 'Exit analysis', locked: !showFullAnalysis },
  ]

  // ── Shared Return Analysis content blocks ───────────────────────────────────
  const financingHeader = (
    <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-5">Financing</p>
  )

  const paymentPlanSubSection = yearGroups.length > 0 ? (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-brand-muted">Payment plan</p>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
          project.payment_plan_confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {project.payment_plan_confirmed ? 'Confirmed' : 'Indicative'}
        </span>
      </div>
      <div className="space-y-2.5">
        {yearGroups.map((g, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className={`text-sm ${g.isHandover ? 'font-semibold text-brand-text' : 'text-brand-muted'}`}>
                {g.label}
              </span>
              {g.isHandover && (
                <div className="flex items-center rounded-full border border-brand-border overflow-hidden" style={{ fontSize: 10, alignSelf: 'flex-start' }}>
                  <button
                    onClick={() => setFinancing('cash')}
                    className={`px-2.5 py-0.5 font-medium transition-colors ${financing === 'cash' ? 'text-white' : 'text-brand-muted'}`}
                    style={financing === 'cash' ? { backgroundColor: '#1C1B18' } : {}}
                  >Cash</button>
                  <button
                    onClick={() => setFinancing('mortgage')}
                    className={`px-2.5 py-0.5 font-medium border-l border-brand-border transition-colors ${financing === 'mortgage' ? 'text-white' : 'text-brand-muted'}`}
                    style={financing === 'mortgage' ? { backgroundColor: '#1C1B18' } : {}}
                  >Mortgage</button>
                </div>
              )}
            </div>
            <div className="text-right">
              <span className={`text-sm font-semibold ${g.isHandover ? '' : 'text-brand-text'}`}
                style={g.isHandover ? { color: '#A0784A' } : {}}>
                {g.pct}%
              </span>
              {basePrice > 0 && (
                <span className="text-sm text-brand-hint ml-2">{fmtA(g.aed)}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null

  const mortgageModellingSection = mortgageOn ? (
    <div className="mb-5">
      <p className="text-xs font-medium text-brand-muted mb-4">Mortgage modelling</p>
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-brand-muted">LTV (loan to value)</span>
              <Tooltip text="Percentage of the property value financed by the mortgage. UAE max is typically 75% for expats." />
            </div>
            <span className="text-sm font-semibold text-brand-text">{ltvPct}%</span>
          </div>
          <input type="range" min={20} max={80} step={5} value={ltvPct}
            onChange={e => setLtvPct(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">20%</span>
            <span className="text-xs text-brand-hint">80%</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-brand-muted">Interest rate</span>
              <Tooltip text="Annual mortgage interest rate. UAE rates typically range from 3.5% to 6%." />
            </div>
            <span className="text-sm font-semibold text-brand-text">{mortgageRate.toFixed(1)}%</span>
          </div>
          <input type="range" min={2} max={10} step={0.25} value={mortgageRate}
            onChange={e => setMortgageRate(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">2%</span>
            <span className="text-xs text-brand-hint">10%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <p className="text-[10px] text-brand-hint mb-1">Loan amount</p>
            <p className="text-sm font-semibold text-brand-text">{fmtA(loanAmount)}</p>
          </div>
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <p className="text-[10px] text-brand-hint mb-1">Monthly payment</p>
            <p className="text-sm font-semibold text-brand-text">{fmtA(monthlyPayment)}</p>
          </div>
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <p className="text-[10px] text-brand-hint mb-1">Annual mortgage cost</p>
            <p className="text-sm font-semibold text-brand-text">{fmtA(annualMortgageCost)}</p>
          </div>
        </div>

        {basePrice > 0 && (
          <div className="rounded-lg p-3.5" style={{ backgroundColor: '#F4F3F0' }}>
            <p className="text-xs font-medium text-brand-muted mb-3">Net monthly cash flow (post-handover)</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-brand-hint">Monthly rent</span>
                <span className="font-medium text-brand-text">{fmtA(Math.round(rent / 12))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-hint">Service charge</span>
                <span className="text-brand-text">−{fmtA(Math.round(serviceCharge / 12))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-hint">Mortgage payment</span>
                <span className="text-brand-text">−{fmtA(monthlyPayment)}</span>
              </div>
              <div className="border-t border-brand-border pt-1.5 flex justify-between text-xs font-semibold">
                <span className="text-brand-text">Net monthly</span>
                <span style={{ color: netMonthly >= 0 ? '#059669' : '#EF4444' }}>
                  {netMonthly >= 0 ? '+' : ''}{fmtA(Math.abs(netMonthly))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : null

  const grossYield   = basePrice > 0 ? (rent / basePrice) * 100 : null
  const netYield     = basePrice > 0 ? ((rent - serviceCharge) / basePrice) * 100 : null
  const cashOnCash   = totalPaidBeforeHO > 0 ? (netIncome / totalPaidBeforeHO) * 100 : null

  const breakEvenSection = (
    <div className="border-t border-brand-border pt-5">
      <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--color-text-primary)' }}>Key return metrics</p>
      <p className="text-[11px] mb-4" style={{ color: 'var(--color-text-secondary)' }}>Based on current assumptions and total cash invested to handover</p>
      <div className="flex gap-3 overflow-x-auto pb-1">

        {/* Gross yield */}
        <div className="rounded-lg flex-shrink-0 flex-1 min-w-[120px]" style={{ backgroundColor: 'var(--color-background-secondary)', padding: '8px 12px' }}>
          <div className="flex items-center gap-1 mb-1">
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Gross yield</p>
            <Tooltip text="Rent at handover as a percentage of purchase price." />
          </div>
          <p className="font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
            {grossYield !== null ? `${grossYield.toFixed(1)}%` : '—'}
          </p>
        </div>

        {/* Net yield */}
        <div className="rounded-lg flex-shrink-0 flex-1 min-w-[120px]" style={{ backgroundColor: 'var(--color-background-secondary)', padding: '8px 12px' }}>
          <div className="flex items-center gap-1 mb-1">
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Net yield</p>
            <Tooltip text="Rent at handover minus service charge, as a percentage of purchase price." />
          </div>
          <p className="font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
            {netYield !== null ? `${netYield.toFixed(1)}%` : '—'}
          </p>
        </div>

        {/* Cash-on-cash return */}
        <div className="rounded-lg flex-shrink-0 flex-1 min-w-[140px]" style={{ backgroundColor: 'var(--color-background-secondary)', padding: '8px 12px' }}>
          <div className="flex items-center gap-1 mb-1">
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Cash-on-cash return</p>
            <Tooltip text="Net annual income as a percentage of cash invested before handover." />
          </div>
          <p className="font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
            {cashOnCash !== null ? `${cashOnCash.toFixed(1)}%` : '—'}
          </p>
        </div>

        {/* Annual cash flow */}
        <div className="rounded-lg flex-shrink-0 flex-1 min-w-[140px]" style={{ backgroundColor: 'var(--color-background-secondary)', padding: '8px 12px' }}>
          <div className="flex items-center gap-1 mb-1">
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Annual cash flow</p>
            <Tooltip text={mortgageOn ? 'Rent at handover, less service charge and annual mortgage cost.' : 'Rent at handover, less service charge.'} />
          </div>
          <p className="font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
            {(() => { const v = Math.round(netIncome - (mortgageOn ? annualMortgageCost : 0)); return `AED ${v.toLocaleString()}` })()}
          </p>
        </div>

        {/* Min. rent at handover */}
        <div className="rounded-lg flex-shrink-0 flex-1 min-w-[140px]" style={{ backgroundColor: 'var(--color-background-secondary)', padding: '8px 12px' }}>
          <div className="flex items-center gap-1 mb-1">
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Min. rent at handover</p>
            <Tooltip text="Minimum rent at handover needed to cover service charge (and mortgage if applicable)." />
          </div>
          <p className="font-semibold" style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>
            {minRent > 0 ? `AED ${Math.round(minRent).toLocaleString()}` : '—'}
          </p>
        </div>

      </div>
    </div>
  )

  const exitAnalysisContent = (
    <>
      {basePrice > 0 && handoverValue > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Gain on paper at handover</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">Gain on paper</span>
                <Tooltip text="Estimated value at handover minus your purchase price. Not realised until you sell." />
              </div>
              <p className={`text-lg font-bold ${gainOnPaper >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {gainOnPaper >= 0 ? '+' : ''}{fmtA(gainOnPaper)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">Return on equity</span>
                <Tooltip text="Gain as a % of cash paid before handover." />
              </div>
              <p className={`text-lg font-bold ${(returnOnEquity ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {returnOnEquity !== null ? `${returnOnEquity >= 0 ? '+' : ''}${fmtP(returnOnEquity)}` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-brand-border p-5">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs text-brand-muted">IRR to handover</span>
                <Tooltip text="Annualised return from purchase to handover, accounting for the staggered payment plan." />
              </div>
              <p className={`text-lg font-bold ${(handoverIRR ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {handoverIRR !== null ? `${handoverIRR >= 0 ? '+' : ''}${fmtP(handoverIRR)}` : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Exit scenarios</p>
        <div
          ref={exitScrollRef}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            gap: 12,
            paddingBottom: 4,
          }}
        >
          {exitScenarios.map(s => {
            const isActive = holdPeriod === s.holdYrs
            return (
              <div
                key={s.holdYrs}
                className={`rounded-xl border p-5 transition-all ${isActive ? '' : 'bg-white border-brand-border'}`}
                style={isActive ? { borderColor: '#A0784A', backgroundColor: '#FDFCF9', flex: '1 0 260px', scrollSnapAlign: 'center' } : { flex: '1 0 260px', scrollSnapAlign: 'center' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-brand-text">{s.label}</p>
                  {isActive && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#A0784A' }}>
                      Selected
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">Exit value</p>
                    <p className="text-sm font-semibold text-brand-text">{fmtA(s.exitValue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">Total return</p>
                    <p className={`text-sm font-semibold ${s.totalReturn >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.totalReturn >= 0 ? '+' : ''}{fmtA(s.totalReturn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-brand-hint mb-0.5">IRR</p>
                    <p className={`text-sm font-bold ${(s.irr ?? 0) >= 8 ? 'text-emerald-600' : (s.irr ?? 0) >= 0 ? 'text-brand-text' : 'text-red-500'}`}>
                      {s.irr !== null ? fmtP(s.irr) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )

  const lockCTA = (
    <div className="rounded-2xl border border-brand-border bg-white p-8 flex flex-col items-center text-center gap-5">
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: '#F4F3F0' }}>
        <svg className="w-6 h-6 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-brand-text mb-2">Full breakdown locked</p>
        <p className="text-xs text-brand-muted leading-relaxed">
          Financing, scenario modelling and exit analysis — all in one place. Available to registered clients only.
        </p>
      </div>
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 text-sm font-medium text-white px-5 py-2.5 rounded-lg transition-colors"
        style={{ backgroundColor: '#A0784A' }}
      >
        Enquire for access →
      </Link>
    </div>
  )

  return (
    <div className="py-10 space-y-8">

      <SecondaryPillNav sections={secondaryNavSections} />

      {/* ── 1. Unit selection ─────────────────────────────────────────────── */}
      <div id="unit-selection">
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Select unit</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {bedroomGroups.map(b => {
            const active = selectedBedrooms === b
            const price = minPriceByGroup.get(b)
            const sqft = minSqftByGroup.get(b)
            return (
              <button
                key={String(b)}
                onClick={() => setSelectedBedrooms(b)}
                style={active
                  ? { borderRadius: 'var(--border-radius-lg)', border: '1.5px solid #1a1a1a', padding: '12px 16px', background: 'var(--color-background-secondary)', transition: 'border-color 0.15s, background 0.15s' }
                  : { borderRadius: 'var(--border-radius-lg)', border: '0.5px solid #E5E3DE', padding: '12px 16px', background: 'white', transition: 'border-color 0.15s, background 0.15s' }}
                className="flex flex-col items-start text-left"
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: active ? '#1a1a1a' : '#3D3D3D', lineHeight: 1.2 }}>
                  {bedroomLabel(b)}
                </span>
                {price != null && (
                  <span style={{ fontSize: 13, color: '#8B6914', marginTop: 3, lineHeight: 1.2 }}>
                    From AED {price.toLocaleString()}
                  </span>
                )}
                {sqft != null && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, lineHeight: 1.2 }}>
                    {sqft.toLocaleString()} sqft
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {unitsInGroup.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {unitsInGroup.map(ut => {
              const active = selectedUnitId === ut.id
              const muted = active ? 'text-white/60' : 'text-brand-hint'
              return (
                <button key={ut.id} onClick={() => setSelectedUnitId(ut.id)}
                  className={active ? SPILL_ON : SPILL_OFF}
                  style={active ? { backgroundColor: '#8B6914' } : {}}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{ut.typology ?? ut.type}</span>
                  <span className={`font-normal mt-0.5 ${muted}`} style={{ fontSize: 12 }}>
                    From {fmtA(ut.price_from)}
                  </span>
                  {ut.internal_sqft != null && (
                    <span className={`font-normal mt-0.5 ${muted}`} style={{ fontSize: 11 }}>
                      {ut.internal_sqft.toLocaleString()} sqft
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 2. Inputs ─────────────────────────────────────────────────────── */}
      <div id="inputs" className="bg-white rounded-xl border border-brand-border p-5 space-y-6">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-brand-muted"
          style={{ backgroundColor: '#F4F3F0' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Estimated — adjust to explore scenarios
        </span>

        {/* Purchase price */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-brand-muted">Purchase price</span>
              <Tooltip text="The price you'd actually pay. The lowest figure is this unit type's starting price — a better unit costs more, so raising this puts more capital in against the same rent." />
            </div>
            <span className="text-sm font-semibold text-brand-text">{fmtA(price)}</span>
          </div>
          <input type="range" min={priceBounds.min} max={priceBounds.max} step={priceBounds.step} value={price}
            onChange={e => handlePriceChange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">AED {priceBounds.min.toLocaleString()}</span>
            <span className="text-xs text-brand-hint">AED {priceBounds.max.toLocaleString()}</span>
          </div>
        </div>

        {/* Rent */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Expected rent at handover</span>
            <span className="text-sm font-semibold text-brand-text">AED {rent.toLocaleString()}</span>
          </div>
          <input type="range" min={rentBounds.min} max={rentBounds.max} step={rentBounds.step} value={rent}
            onChange={e => setRent(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">AED {rentBounds.min.toLocaleString()}</span>
            <span className="text-xs text-brand-hint">AED {rentBounds.max.toLocaleString()}</span>
          </div>
        </div>

        {/* Handover value */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Est. value at handover</span>
            <span className="text-sm font-semibold text-brand-text">{fmtA(handoverValue)}</span>
          </div>
          <input type="range" min={hvBounds.min} max={hvBounds.max} step={hvBounds.step} value={handoverValue}
            onChange={e => setHandoverValue(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">AED {hvBounds.min.toLocaleString()}</span>
            <span className="text-xs text-brand-hint">AED {hvBounds.max.toLocaleString()}</span>
          </div>
        </div>

        {/* Growth */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Annual capital growth (post-handover)</span>
            <span className="text-sm font-semibold text-brand-text">{growth.toFixed(1)}%</span>
          </div>
          <input type="range" min={0} max={15} step={0.5} value={growth}
            onChange={e => setGrowth(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">0%</span>
            <span className="text-xs text-brand-hint">15%</span>
          </div>
        </div>

        {/* Hold period */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-muted">Hold period from handover</span>
            <span className="text-sm font-semibold text-brand-text">
              {holdPeriod === 0 ? 'Sell at handover' : `${holdPeriod} yr${holdPeriod > 1 ? 's' : ''}`}
            </span>
          </div>
          <input type="range" min={0} max={15} step={1} value={holdPeriod}
            onChange={e => setHoldPeriod(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#A0784A' }} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-brand-hint">0 yrs = sell at handover</span>
            <span className="text-xs text-brand-hint">15 yrs</span>
          </div>
        </div>
      </div>

      {/* ── 3-5. Scenarios / Financing / Exit analysis ──────────────────────── */}
      <div className="space-y-8">

        {/* ── 4. Scenarios ──────────────────────────────────────────────── */}
        <div id="scenarios">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Scenarios</p>
          <div
            ref={scenarioScrollRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              gap: 12,
              paddingBottom: 4,
            }}
          >
            {([
              { label: 'Conservative', metrics: conservative, highlighted: false },
              { label: 'Base',         metrics: base,         highlighted: true  },
              { label: 'Optimistic',   metrics: optimistic,   highlighted: false },
            ] as const).map(({ label, metrics: m, highlighted }) => (
              <div key={label}
                className={`bg-white rounded-xl border p-5 ${highlighted ? '' : 'border-brand-border'}`}
                style={highlighted ? { borderColor: '#A0784A', flex: '1 0 260px', scrollSnapAlign: 'center' } : { flex: '1 0 260px', scrollSnapAlign: 'center' }}>
                <div className={`flex items-center justify-between mb-4 ${!showFullAnalysis ? 'blur-sm select-none' : ''}`}>
                  <p className="text-xs font-semibold text-brand-muted">{label}</p>
                  {highlighted && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: '#A0784A' }}>
                      Base case
                    </span>
                  )}
                </div>
                {m.mode === 'hold' ? (
                  <div className="space-y-3">
                    <div className={!showFullAnalysis && !highlighted ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Net yield</p>
                      <p className="text-lg font-semibold text-brand-text">{fmtP(m.netYield)}</p>
                    </div>
                    <div className={!showFullAnalysis ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Value at exit</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.valueAtExit)}</p>
                    </div>
                    <div className={!showFullAnalysis ? 'blur-sm select-none' : ''}>
                      <p className="text-xs text-brand-hint mb-0.5">Total return</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.totalReturn)}</p>
                    </div>
                    {m.irr !== null && (
                      <div className={`pt-2 border-t border-brand-border ${!showFullAnalysis ? 'blur-sm select-none' : ''}`}>
                        <p className="text-xs text-brand-hint mb-0.5">IRR</p>
                        <p className="text-base font-bold text-brand-text">{fmtP(m.irr)}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`space-y-3 ${!showFullAnalysis ? 'blur-sm select-none' : ''}`}>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Gain on paper</p>
                      <p className="text-lg font-semibold text-brand-text">{fmtA(m.gainOnPaper)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Est. value at handover</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtA(m.scenarioHV)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-hint mb-0.5">Return on capital</p>
                      <p className="text-sm font-semibold text-brand-text">{fmtP(m.returnOnCapital)}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-brand-hint mt-2.5">
            {holdPeriod === 0
              ? 'Conservative assumes 7.5% below estimated handover value. Optimistic assumes 7.5% above.'
              : 'Conservative assumes rent at handover and growth 15% below the base estimate. Optimistic assumes 15% above.'}
          </p>
        </div>

        {showFullAnalysis ? (
          <>
            {/* ── 4. Financing ─────────────────────────────────────────── */}
            <div id="financing" className="bg-white rounded-xl border border-brand-border p-5">
              {financingHeader}
              {paymentPlanSubSection}
              {mortgageModellingSection}
              {breakEvenSection}
            </div>

            {/* ── 6. Exit analysis ─────────────────────────────────────── */}
            <div id="exit-analysis" className="space-y-8">
              {exitAnalysisContent}
            </div>
          </>
        ) : (
          <>
            {/* Full-width divider */}
            <div className="border-t border-brand-border" />

            {/* ── 4. Financing — payment plan (visible) ────────────────── */}
            <div id="financing" className="bg-white rounded-xl border border-brand-border p-5">
              {financingHeader}
              {paymentPlanSubSection}
            </div>

            {/* Full-width divider */}
            <div className="border-t border-brand-border" />

            {/* ── Lock CTA — in-flow block ─────────────────────────────────── */}
            {lockCTA}

            {/* ── Locked content: mortgage modelling + break-even + exit analysis ── */}
            <div className="blur-sm pointer-events-none select-none space-y-8">
              <div className="bg-white rounded-xl border border-brand-border p-5">
                {mortgageModellingSection}
                {breakEvenSection}
              </div>

              <div id="exit-analysis" className="space-y-8">
                {exitAnalysisContent}
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  )
}
