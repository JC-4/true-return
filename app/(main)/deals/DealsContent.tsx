'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const MAX_COMPARE = 4

// ─── Types ────────────────────────────────────────────────────────────────────

type DealParams = {
  price?: number; rent?: number; growth?: number
  internalSqft?: number; balconySqft?: number
  view?: string; unit?: string; project?: string
  completion?: string; developer?: string
  serviceCharge?: number; dld?: number; agencyFee?: number; adminFee?: number
  propertyType?: string; handoverValue?: number
  paymentPlan?: string
  mortgageOn?: boolean; depositPct?: number; interestRate?: number
  termYears?: number; mortgageType?: string
  emirate?: string; location?: string
}

type DealMetrics = {
  grossYield?: number; netYield?: number
  netAnnualIncome?: number; pricePerSqft?: number
  totalAcquisitionCost?: number; cashOnCash?: number
  irr?: number | null; investmentScore?: number; grade?: string
}

type Deal = {
  id: string
  name: string
  savedAt: string
  updatedAt?: string
  params: DealParams
  calculatedMetrics: DealMetrics
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return Math.round(n).toLocaleString('en-US') }
function fmtPct(n: number | undefined, dp = 1) {
  return n !== undefined && n !== null ? n.toFixed(dp) + '%' : '—'
}

function buildCalcUrl(params: DealParams): string {
  const p = new URLSearchParams()
  if (params.price)         p.set('price',         String(params.price))
  if (params.rent)          p.set('rent',           String(params.rent))
  if (params.growth !== undefined) p.set('growth',  String(params.growth))
  if (params.internalSqft)  p.set('internalSqft',   String(params.internalSqft))
  if (params.balconySqft)   p.set('balconySqft',    String(params.balconySqft))
  if (params.view)          p.set('view',           params.view)
  if (params.unit)          p.set('unit',           params.unit)
  if (params.project)       p.set('project',        params.project)
  if (params.completion)    p.set('completion',     params.completion)
  if (params.developer)     p.set('developer',      params.developer)
  if (params.serviceCharge) p.set('serviceCharge',  String(params.serviceCharge))
  if (params.dld !== undefined && params.dld !== 4) p.set('dld', String(params.dld))
  if (params.agencyFee)     p.set('agencyFee',      String(params.agencyFee))
  if (params.adminFee)      p.set('adminFee',       String(params.adminFee))
  if (params.propertyType && params.propertyType !== 'offplan') p.set('propertyType', params.propertyType)
  if (params.handoverValue) p.set('handoverValue',  String(params.handoverValue))
  if (params.paymentPlan && params.paymentPlan !== '[]') {
    p.set('paymentPlan', encodeURIComponent(params.paymentPlan))
  }
  if (params.mortgageOn)                                          p.set('mortgageOn',   'true')
  if (params.depositPct !== undefined)                            p.set('depositPct',   String(params.depositPct))
  if (params.interestRate !== undefined)                          p.set('interestRate', String(params.interestRate))
  if (params.termYears !== undefined)                             p.set('termYears',    String(params.termYears))
  if (params.mortgageType && params.mortgageType !== 'repayment') p.set('mortgageType', params.mortgageType)
  if (params.emirate && params.emirate !== 'Dubai') p.set('emirate', params.emirate)
  if (params.location) p.set('location', params.location)
  return `/calculators/investment?${p.toString()}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

const gradeColor: Record<string, string> = {
  A: 'text-green-700', B: 'text-emerald-600',
  C: 'text-yellow-600', D: 'text-orange-600', F: 'text-red-600',
}

// ─── Deal card ────────────────────────────────────────────────────────────────

function DealCard({
  deal, onDelete, comparing, selected, onToggle,
}: {
  deal: Deal
  onDelete: (id: string) => void
  comparing: boolean
  selected: boolean
  onToggle: (id: string) => void
}) {
  const router = useRouter()
  const m = deal.calculatedMetrics
  const p = deal.params

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Delete "${deal.name}"? This cannot be undone.`)) {
      onDelete(deal.id)
    }
  }

  const subtitle = [
    p.location ? `${p.location}, ${p.emirate ?? 'Dubai'}` : '',
    p.project,
    p.unit ? `Unit ${p.unit}` : '',
    p.developer,
  ].filter(Boolean).join(' · ')

  return (
    <div
      onClick={comparing ? () => onToggle(deal.id) : undefined}
      className={`bg-white rounded-2xl border shadow-sm flex flex-col transition-colors ${
        comparing ? 'cursor-pointer' : ''
      } ${
        selected
          ? 'border-[#10b981] ring-1 ring-[#10b981]'
          : 'border-gray-100'
      }`}
    >
      {/* Card header */}
      <div className="p-5 border-b border-gray-50 relative">
        {comparing && (
          <div className={`absolute top-4 right-4 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            selected ? 'bg-[#10b981] border-[#10b981]' : 'bg-white border-gray-300'
          }`}>
            {selected && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        <div className={`flex items-start gap-2 mb-1 ${comparing ? 'pr-8' : ''}`}>
          <h3 className="text-sm font-semibold text-gray-900 leading-snug flex-1">{deal.name}</h3>
          {!comparing && m.grade && (
            <span className={`text-lg font-bold flex-shrink-0 ${gradeColor[m.grade] ?? 'text-gray-400'}`}>
              {m.grade}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-400 mb-1">{subtitle}</p>}
        <p className="text-xs text-gray-300">Saved {formatDate(deal.savedAt)}</p>
      </div>

      {/* Metrics */}
      <div className="p-5 flex-1">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Gross yield</p>
            <p className="text-sm font-semibold text-green-700">{fmtPct(m.grossYield)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Net yield</p>
            <p className="text-sm font-semibold text-green-700">{fmtPct(m.netYield)}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Net income / yr</p>
            <p className="text-sm font-semibold text-gray-800">
              {m.netAnnualIncome ? `AED ${fmt(m.netAnnualIncome)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Price / sqft</p>
            <p className="text-sm font-semibold text-gray-800">
              {m.pricePerSqft ? `AED ${fmt(m.pricePerSqft)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Investment score</p>
            <p className={`text-sm font-semibold ${m.grade ? (gradeColor[m.grade] ?? 'text-gray-800') : 'text-gray-400'}`}>
              {m.investmentScore !== undefined ? `${m.investmentScore} / 100` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">Total cost</p>
            <p className="text-sm font-semibold text-gray-800">
              {m.totalAcquisitionCost ? `AED ${fmt(m.totalAcquisitionCost)}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions — hidden in compare mode */}
      {!comparing && (
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => router.push(`/deals/${deal.id}`)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-[#18181b] hover:bg-[#27272a] transition-colors"
          >
            Analyse
          </button>
          <button
            onClick={() => {
              const url = buildCalcUrl(p)
              const sep = url.includes('?') ? '&' : '?'
              router.push(`${url}${sep}dealId=${deal.id}`)
            }}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#18181b] bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
          >
            Del
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const router = useRouter()
  const [deals, setDeals]       = useState<Deal[]>([])
  const [loaded, setLoaded]     = useState(false)
  const [comparing, setComparing] = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/user/deals')
      .then(r => r.json())
      .then((index: { id: string }[]) =>
        Promise.all(index.map(e => fetch(`/api/user/deals/${e.id}`).then(r => r.json())))
      )
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function deleteDeal(id: string) {
    await fetch(`/api/user/deals/${id}`, { method: 'DELETE' })
    setDeals(prev => prev.filter(d => d.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) { s.delete(id) } else if (s.size < MAX_COMPARE) { s.add(id) }
      return s
    })
  }

  function startComparing() {
    setSelected(new Set())
    setComparing(true)
  }

  function cancelComparing() {
    setSelected(new Set())
    setComparing(false)
  }

  function goCompare() {
    const ids = Array.from(selected).join(',')
    router.push(`/compare?ids=${ids}`)
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-28">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
              {comparing ? 'Select deals to compare' : 'Saved Deals'}
            </h1>
            <p className="text-sm text-gray-600">
              {comparing
                ? selected.size === 0
                  ? `Select 2–${MAX_COMPARE} deals`
                  : `${selected.size} selected`
                : loaded && deals.length > 0
                  ? `${deals.length} deal${deals.length !== 1 ? 's' : ''} saved`
                  : 'Your saved investment analyses'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {comparing ? (
              <button
                onClick={cancelComparing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <>
                {loaded && deals.length >= 2 && (
                  <button
                    onClick={startComparing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Compare deals
                  </button>
                )}
                <Link
                  href="/calculators/investment"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                >
                  + New analysis
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        {!loaded ? null : deals.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-gray-900 font-semibold text-lg mb-2">No saved deals yet</h2>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              Use the calculator to analyse a deal and save it here.
            </p>
            <Link
              href="/calculators/investment"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#18181b] hover:bg-[#27272a] transition-colors"
            >
              Open calculator →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {deals.map(deal => (
              <DealCard
                key={deal.id}
                deal={deal}
                onDelete={deleteDeal}
                comparing={comparing}
                selected={selected.has(deal.id)}
                onToggle={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom bar — visible when ≥2 selected */}
      {comparing && selected.size >= 2 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 z-30">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{selected.size} deals</span> selected
            </p>
            <button
              onClick={goCompare}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#18181b] hover:bg-[#27272a] transition-colors"
            >
              Compare {selected.size} deals →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
