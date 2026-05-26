'use client'
import { useState, useMemo } from 'react'
import {
  BALCONY_SC_RATIO,
  normalizeCompletionDate,
  computeDealMetrics,
  calculateInvestmentScore,
  type PlanRow,
  type DealMetrics,
  type ScoreBreakdown,
} from '@/lib/calculations'

// ─── InitialValues ────────────────────────────────────────────────────────────
// Used by the insight page embed and /deals/[id]/edit to pre-seed state.

export type InitialValues = {
  // Core financials
  price?: number
  rent?: number
  growth?: number
  handoverValue?: number
  // Property
  propertyType?: 'offplan' | 'secondary'
  propertySubType?: 'apartment' | 'townhouse' | 'villa'
  internalSqft?: number
  balconySqft?: number
  buaSqft?: number
  plotSqft?: number
  scRate?: number
  // Identity / project
  developer?: string      // developer name (string) — used by existing calculator
  developerId?: string    // supabase developer id — used by new builder
  developerTier?: number | null  // supabase tier (1|2|3) — overrides DEVELOPERS name lookup
  projectSlug?: string    // supabase project slug — used by new builder
  project?: string        // project display name
  completion?: string
  unit?: string
  view?: string
  emirate?: 'Dubai' | 'Abu Dhabi'
  location?: string
  // Payment plan
  paymentPlan?: PlanRow[]
  // Acquisition costs
  dldPct?: number
  agencyFeePct?: number
  adminFee?: number
  // Mortgage
  mortgageOn?: boolean
  depositPct?: number
  interestRate?: number
  termYears?: number
  mortgageType?: 'repayment' | 'interest-only'
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export type UseCalculatorReturn = {
  // ── Core inputs ──
  price: number;        setPrice:        (v: number) => void
  rent: number;         setRent:         (v: number) => void
  growth: number;       setGrowth:       (v: number) => void
  handoverValue: number; setHandoverValue: (v: number) => void

  // ── Property ──
  propertyType: 'offplan' | 'secondary'
  setPropertyType: (v: 'offplan' | 'secondary') => void
  propertySubType: 'apartment' | 'townhouse' | 'villa'
  setPropertySubType: (v: 'apartment' | 'townhouse' | 'villa') => void
  internalSqft: number; setInternalSqft: (v: number) => void
  balconySqft: number;  setBalconySqft:  (v: number) => void
  buaSqft: number;      setBuaSqft:      (v: number) => void
  plotSqft: number;     setPlotSqft:     (v: number) => void
  scRate: number;       setScRate:       (v: number) => void
  scInput: string;      setScInput:      (v: string) => void

  // ── Identity / project ──
  developer: string;    setDeveloper:    (v: string) => void
  developerId: string;  setDeveloperId:  (v: string) => void
  developerTier: number | null; setDeveloperTier: (v: number | null) => void
  projectSlug: string;  setProjectSlug:  (v: string) => void
  project: string;      setProject:      (v: string) => void
  completion: string;   setCompletion:   (v: string) => void
  unit: string;         setUnit:         (v: string) => void
  view: string;         setView:         (v: string) => void
  emirate: 'Dubai' | 'Abu Dhabi'
  setEmirate: (v: 'Dubai' | 'Abu Dhabi') => void
  location: string;     setLocation:     (v: string) => void

  // ── Acquisition costs ──
  dldPct: number;       setDldPct:       (v: number) => void
  dldInput: string;     setDldInput:     (v: string) => void
  agencyFeePct: number; setAgencyFeePct: (v: number) => void
  agencyFeeInput: string; setAgencyFeeInput: (v: string) => void
  adminFee: number;     setAdminFee:     (v: number) => void
  adminFeeInput: string; setAdminFeeInput: (v: string) => void

  // ── Mortgage ──
  mortgageOn: boolean;  setMortgageOn:   (v: boolean) => void
  depositPct: number;   setDepositPct:   (v: number) => void
  interestRate: number; setInterestRate: (v: number) => void
  termYears: number;    setTermYears:    (v: number) => void
  mortgageType: 'repayment' | 'interest-only'
  setMortgageType: (v: 'repayment' | 'interest-only') => void

  // ── Payment plan ──
  paymentPlan: PlanRow[]
  setPaymentPlan: (p: PlanRow[] | ((prev: PlanRow[]) => PlanRow[])) => void
  addPlanRow: () => void
  removePlanRow: (id: string) => void
  updatePlanRow: (id: string, field: keyof Omit<PlanRow, 'id'>, val: string | number | boolean) => void
  toggleHandover: (id: string) => void
  planTotal: number
  planComplete: boolean

  // ── Derived ──
  isApartment: boolean
  bua: number
  hasKeyInputs: boolean
  completionValid: boolean

  // ── Computed metrics (null when price/rent not entered) ──
  metrics: DealMetrics | null
  scoreBreakdown: ScoreBreakdown | null
  scoreMissing: string[]

  // ── Convenience: serialise state to deal params (for saving) ──
  toDealParams: () => DealParamsPayload
}

export type DealParamsPayload = {
  propertyType: string; propertySubType: string
  price: number; rent: number; growth: number
  internalSqft: number; balconySqft: number
  buaSqft?: number; plotSqft?: number
  view: string; unit: string; project: string
  completion: string; developer: string
  developerId?: string; projectSlug?: string
  emirate: string; location: string
  serviceCharge: number; dld: number; agencyFee: number; adminFee: number
  handoverValue?: number
  paymentPlan: string
  mortgageOn: boolean; depositPct: number; interestRate: number
  termYears: number; mortgageType: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalculator(initialValues?: InitialValues): UseCalculatorReturn {
  // ── Core inputs ──
  const [price,         setPrice]         = useState(initialValues?.price         ?? 0)
  const [rent,          setRent]          = useState(initialValues?.rent          ?? 0)
  const [growth,        setGrowth]        = useState(initialValues?.growth        ?? 5)
  const [handoverValue, setHandoverValue] = useState(initialValues?.handoverValue ?? 0)

  // ── Property ──
  const [propertyType,    setPropertyType]    = useState<'offplan' | 'secondary'>(initialValues?.propertyType    ?? 'offplan')
  const [propertySubType, setPropertySubType] = useState<'apartment' | 'townhouse' | 'villa'>(initialValues?.propertySubType ?? 'apartment')
  const [internalSqft,    setInternalSqft]    = useState(initialValues?.internalSqft ?? 0)
  const [balconySqft,     setBalconySqft]     = useState(initialValues?.balconySqft  ?? 0)
  const [buaSqft,         setBuaSqft]         = useState(initialValues?.buaSqft      ?? 0)
  const [plotSqft,        setPlotSqft]        = useState(initialValues?.plotSqft     ?? 0)
  const [scRate,          setScRate]          = useState(initialValues?.scRate        ?? 0)
  const [scInput,         setScInput]         = useState(initialValues?.scRate ? String(initialValues.scRate) : '')

  // ── Identity / project ──
  const [developer,     setDeveloper]     = useState(initialValues?.developer     ?? '')
  const [developerId,   setDeveloperId]   = useState(initialValues?.developerId   ?? '')
  const [developerTier, setDeveloperTier] = useState<number | null>(initialValues?.developerTier ?? null)
  const [projectSlug, setProjectSlug] = useState(initialValues?.projectSlug ?? '')
  const [project,     setProject]     = useState(initialValues?.project     ?? '')
  const [completion,  setCompletion]  = useState(() => {
    const raw = initialValues?.completion ?? ''
    return raw ? normalizeCompletionDate(raw) : ''
  })
  const [unit,     setUnit]     = useState(initialValues?.unit     ?? '')
  const [view,     setView]     = useState(initialValues?.view     ?? '')
  const [emirate,  setEmirate]  = useState<'Dubai' | 'Abu Dhabi'>(initialValues?.emirate ?? 'Dubai')
  const [location, setLocation] = useState(initialValues?.location ?? '')

  // ── Acquisition costs ──
  const [dldPct,         setDldPct]         = useState(initialValues?.dldPct       ?? 4)
  const [dldInput,       setDldInput]       = useState(String(initialValues?.dldPct ?? 4))
  const [agencyFeePct,   setAgencyFeePct]   = useState(initialValues?.agencyFeePct ?? 0)
  const [agencyFeeInput, setAgencyFeeInput] = useState(initialValues?.agencyFeePct ? String(initialValues.agencyFeePct) : '')
  const [adminFee,       setAdminFee]       = useState(initialValues?.adminFee     ?? 0)
  const [adminFeeInput,  setAdminFeeInput]  = useState(initialValues?.adminFee ? String(initialValues.adminFee) : '')

  // ── Mortgage ──
  const [mortgageOn,   setMortgageOn]   = useState(initialValues?.mortgageOn   ?? false)
  const [depositPct,   setDepositPct]   = useState(initialValues?.depositPct   ?? 25)
  const [interestRate, setInterestRate] = useState(initialValues?.interestRate ?? 4.0)
  const [termYears,    setTermYears]    = useState(initialValues?.termYears    ?? 25)
  const [mortgageType, setMortgageType] = useState<'repayment' | 'interest-only'>(initialValues?.mortgageType ?? 'repayment')

  // ── Payment plan ──
  const [paymentPlan, setPaymentPlan] = useState<PlanRow[]>(initialValues?.paymentPlan ?? [])

  // Payment plan helpers
  const addPlanRow    = () => setPaymentPlan(p => [...p, { id: `row-${Date.now()}`, label: '', date: '', pct: 0 }])
  const removePlanRow = (id: string) => setPaymentPlan(p => p.filter(r => r.id !== id))
  const updatePlanRow = (id: string, field: keyof Omit<PlanRow, 'id'>, val: string | number | boolean) =>
    setPaymentPlan(p => p.map(r => r.id === id ? { ...r, [field]: val } : r))
  const toggleHandover = (id: string) =>
    setPaymentPlan(p => p.map(r => ({ ...r, handover: r.id === id ? !r.handover : false })))

  const planTotal    = paymentPlan.reduce((s, r) => s + r.pct, 0)
  const planComplete = Math.abs(planTotal - 100) < 0.01

  // ── Derived convenience ──
  const isApartment    = propertySubType === 'apartment'
  const bua            = isApartment ? internalSqft + balconySqft : buaSqft
  const hasKeyInputs   = price > 0 && rent > 0
  const completionValid = !completion || /^\d{1,2}\/\d{4}$/.test(completion)

  // ── Computed metrics ──
  const metrics = useMemo<DealMetrics | null>(() => {
    if (!hasKeyInputs) return null
    return computeDealMetrics({
      propertyType,
      price, rent, growth,
      internalSqft, balconySqft, scRate,
      buaSqft: isApartment ? undefined : buaSqft,
      completion, developer, developerTierOverride: developerTier, handoverValue,
      paymentPlan,
      dldPct, agencyFeePct, adminFee,
      mortgageOn, depositPct, interestRate, termYears,
    })
  }, [
    propertyType, price, rent, growth,
    internalSqft, balconySqft, scRate, isApartment, buaSqft,
    completion, developer, developerTier, handoverValue,
    paymentPlan,
    dldPct, agencyFeePct, adminFee,
    mortgageOn, depositPct, interestRate, termYears,
    hasKeyInputs,
  ])

  const scoreBreakdown = metrics?.breakdown ?? null
  const scoreMissing   = metrics?.missingItems ?? []

  // ── Serialise to deal params for saving ──
  function toDealParams(): DealParamsPayload {
    const p: DealParamsPayload = {
      propertyType, propertySubType,
      price, rent, growth,
      internalSqft, balconySqft,
      view, unit, project,
      completion, developer,
      emirate, location,
      serviceCharge: scRate,
      dld: dldPct,
      agencyFee: agencyFeePct,
      adminFee,
      paymentPlan: JSON.stringify(
        paymentPlan.map(r => ({ label: r.label, date: r.date, pct: r.pct, ...(r.handover ? { handover: true } : {}) }))
      ),
      mortgageOn, depositPct, interestRate, termYears, mortgageType,
    }
    if (!isApartment) { p.buaSqft = buaSqft; p.plotSqft = plotSqft }
    if (handoverValue > 0) p.handoverValue = handoverValue
    if (developerId) p.developerId = developerId
    if (projectSlug) p.projectSlug = projectSlug
    return p
  }

  return {
    price, setPrice,
    rent, setRent,
    growth, setGrowth,
    handoverValue, setHandoverValue,

    propertyType, setPropertyType,
    propertySubType, setPropertySubType,
    internalSqft, setInternalSqft,
    balconySqft, setBalconySqft,
    buaSqft, setBuaSqft,
    plotSqft, setPlotSqft,
    scRate, setScRate,
    scInput, setScInput,

    developer, setDeveloper,
    developerId, setDeveloperId,
    developerTier, setDeveloperTier,
    projectSlug, setProjectSlug,
    project, setProject,
    completion, setCompletion,
    unit, setUnit,
    view, setView,
    emirate, setEmirate,
    location, setLocation,

    dldPct, setDldPct,
    dldInput, setDldInput,
    agencyFeePct, setAgencyFeePct,
    agencyFeeInput, setAgencyFeeInput,
    adminFee, setAdminFee,
    adminFeeInput, setAdminFeeInput,

    mortgageOn, setMortgageOn,
    depositPct, setDepositPct,
    interestRate, setInterestRate,
    termYears, setTermYears,
    mortgageType, setMortgageType,

    paymentPlan, setPaymentPlan,
    addPlanRow, removePlanRow, updatePlanRow, toggleHandover,
    planTotal, planComplete,

    isApartment, bua, hasKeyInputs, completionValid,
    metrics, scoreBreakdown, scoreMissing,
    toDealParams,
  }
}
