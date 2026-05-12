'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Residency = 'national' | 'resident' | 'nonresident'

const RESIDENCY_LABELS: Record<Residency, string> = {
  national:    'UAE national',
  resident:    'UAE resident',
  nonresident: 'Non resident',
}

function getMinDeposit(residency: Residency, price: number): number {
  if (residency === 'national')    return price >= 5000000 ? 25 : 15
  if (residency === 'resident')    return price >= 5000000 ? 30 : 20
  return 40 // non resident — flat regardless of price
}

const CONTEXT: Record<Residency, { items: { label: string; value: string }[] }> = {
  national: {
    items: [
      { label: 'Minimum deposit',   value: '15% for properties under AED 5M · 25% above AED 5M' },
      { label: 'Max LTV',           value: '85% (<5M) · 75% (≥5M)' },
      { label: 'Max term',          value: '25 years (to age 70)' },
      { label: 'Typical rates',     value: '4.0–5.5% p.a. (EIBOR-linked)' },
      { label: 'Additional costs',  value: 'DLD 4%, mortgage registration 0.25% of loan, arrangement 0–1% of loan, agency 2% + VAT' },
    ],
  },
  resident: {
    items: [
      { label: 'Minimum deposit',   value: '20% for properties under AED 5M · 30% above AED 5M' },
      { label: 'Max LTV',           value: '80% (<5M) · 70% (≥5M)' },
      { label: 'Max term',          value: '25 years (to age 65 employees · 70 self-employed)' },
      { label: 'Typical rates',     value: '4.0–5.5% p.a. (EIBOR-linked)' },
      { label: 'Additional costs',  value: 'DLD 4%, mortgage registration 0.25% of loan, arrangement 0–1% of loan, agency 2% + VAT' },
    ],
  },
  nonresident: {
    items: [
      { label: 'Minimum deposit',   value: '40% (flat — no price threshold)' },
      { label: 'Max LTV',           value: '60%' },
      { label: 'Max term',          value: '25 years (fewer lenders offer full term to non-residents)' },
      { label: 'Typical rates',     value: '4.5–6.0% p.a. — typically higher margin than residents' },
      { label: 'Additional costs',  value: 'DLD 4%, mortgage registration 0.25% of loan, arrangement 0–1% of loan (sometimes higher), agency 2% + VAT' },
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US')
}

// ─── Residency selector ───────────────────────────────────────────────────────

function ResidencySelector({
  value,
  onChange,
}: {
  value: Residency
  onChange: (v: Residency) => void
}) {
  const options: Residency[] = ['national', 'resident', 'nonresident']
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            i > 0 ? 'border-l border-gray-200' : ''
          } ${
            value === opt
              ? 'bg-[#18181b] text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-800'
          }`}
        >
          {RESIDENCY_LABELS[opt]}
        </button>
      ))}
    </div>
  )
}

// ─── Collapsible context panel ────────────────────────────────────────────────

function ContextPanel({ residency }: { residency: Residency }) {
  const [open, setOpen] = useState(false)
  const ctx = CONTEXT[residency]

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          Mortgage context · {RESIDENCY_LABELS[residency]}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 px-5 py-4">
          <dl className="space-y-2">
            {ctx.items.map(({ label, value }) => (
              <div key={label} className="flex gap-3 text-sm">
                <dt className="text-gray-600 font-medium flex-shrink-0 w-36">{label}</dt>
                <dd className="text-gray-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

// ─── Editable slider (slider + typed input in sync) ───────────────────────────

function EditableSlider({
  label,
  value,
  min,
  max,
  step,
  sliderLabel,
  inputPrefix,
  inputSuffix,
  decimalPlaces = 0,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  sliderLabel: string
  inputPrefix?: string
  inputSuffix?: string
  decimalPlaces?: number
  onChange: (v: number) => void
}) {
  const [raw, setRaw]         = useState('')
  const [editing, setEditing] = useState(false)

  const formatted = decimalPlaces > 0
    ? value.toFixed(decimalPlaces)
    : Math.round(value).toLocaleString('en-US')

  function commit(str: string) {
    const num = parseFloat(str.replace(/,/g, ''))
    if (!isNaN(num)) onChange(Math.min(max, Math.max(min, num)))
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="text-xs text-gray-500 font-medium flex-shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          {inputPrefix && <span className="text-xs text-gray-400">{inputPrefix}</span>}
          <input
            type="text"
            inputMode="decimal"
            className="text-sm font-semibold text-gray-900 text-right bg-gray-50 border border-gray-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:bg-white"
            value={editing ? raw : formatted}
            onFocus={() => {
              setRaw(decimalPlaces > 0 ? value.toFixed(decimalPlaces) : String(Math.round(value)))
              setEditing(true)
            }}
            onChange={e => setRaw(e.target.value)}
            onBlur={e => commit(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commit((e.target as HTMLInputElement).value)
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          {inputSuffix && <span className="text-xs text-gray-400">{inputSuffix}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-300 w-16 text-right flex-shrink-0">
          {inputPrefix}{decimalPlaces > 0 ? min.toFixed(decimalPlaces) : fmt(min)}{inputSuffix}
        </span>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full"
          aria-label={sliderLabel}
        />
        <span className="text-xs text-gray-300 w-16 flex-shrink-0">
          {inputPrefix}{decimalPlaces > 0 ? max.toFixed(decimalPlaces) : fmt(max)}{inputSuffix}
        </span>
      </div>
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center ml-1.5 cursor-help">
      <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <span className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2.5 opacity-0 group-hover:opacity-100 pointer-events-none z-50 leading-relaxed shadow-xl transition-opacity">
        {text}
        <span className="absolute top-full left-3.5 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  )
}

function TermSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-gray-500 font-medium">Term</span>
        <span className="text-sm font-semibold text-gray-900">{value} years</span>
      </div>
      <input
        type="range" min={5} max={25} step={1} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MortgageCalculatorPage() {
  const [residency,    setResidency]    = useState<Residency>('resident')
  const [price,        setPrice]        = useState(2000000)
  const [depositPct,   setDepositPct]   = useState(20)
  const [interestRate, setInterestRate] = useState(4.50)
  const [termYears,    setTermYears]    = useState(25)

  const minDeposit = getMinDeposit(residency, price)

  // Bump deposit up whenever the floor rises (residency change or price crossing 5M)
  useEffect(() => {
    if (depositPct < minDeposit) setDepositPct(minDeposit)
  }, [minDeposit])

  // Reset deposit to floor when switching residency type
  const handleResidencyChange = (r: Residency) => {
    setResidency(r)
    const newMin = getMinDeposit(r, price)
    if (depositPct < newMin) setDepositPct(newMin)
  }

  const loanAmount        = price * (1 - depositPct / 100)
  const depositAmount     = price * (depositPct / 100)
  const ltv               = 100 - depositPct
  const monthlyRate       = interestRate / 100 / 12
  const termMonths        = termYears * 12
  const monthlyPayment    = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)
    : loanAmount / termMonths
  const totalPaid         = monthlyPayment * termMonths
  const totalInterest     = totalPaid - loanAmount

  // Upfront cost components
  const dldFee            = price * 0.04 + 580
  const trusteeFee        = (price < 500000 ? 2000 : 4000) * 1.05   // + 5% VAT
  const mortgageRegFee    = loanAmount * 0.0025
  const arrangementLow    = 0                                         // some banks waive this
  const arrangementHigh   = loanAmount * 0.01  * 1.05                // 1.0% + VAT
  const valuationFee      = 3150                                      // fixed
  const agencyFee         = price * 0.02
  const agencyTotal       = agencyFee * 1.05                          // + 5% VAT

  const upfrontLow  = depositAmount + dldFee + trusteeFee + mortgageRegFee + arrangementLow  + valuationFee + agencyTotal
  const upfrontHigh = depositAmount + dldFee + trusteeFee + mortgageRegFee + arrangementHigh + valuationFee + agencyTotal

  const depositBumped = depositPct === minDeposit && minDeposit > (residency === 'national' ? 15 : residency === 'resident' ? 20 : 40)

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">UAE mortgage</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mortgage Calculator</h1>
          <p className="text-sm text-gray-600">
            Estimate monthly repayments and total cost for a Dubai property purchase.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">

        {/* Collapsible context — dynamic per residency */}
        <ContextPanel residency={residency} />

        {/* Inputs */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Inputs</p>
          <div className="space-y-6">

            {/* Residency selector */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Residency status</p>
              <ResidencySelector value={residency} onChange={handleResidencyChange} />
            </div>

            <EditableSlider
              label="Purchase price"
              value={price} min={500000} max={15000000} step={50000}
              sliderLabel="Purchase price slider"
              inputPrefix="AED "
              onChange={setPrice}
            />

            <div>
              <EditableSlider
                label="Deposit"
                value={depositPct} min={minDeposit} max={60} step={1}
                sliderLabel="Deposit percentage slider"
                inputSuffix="%"
                onChange={v => setDepositPct(Math.max(minDeposit, v))}
              />
              <p className="text-xs text-gray-400 mt-1.5">AED {fmt(depositAmount)} cash</p>
              {depositBumped && (
                <p className="text-xs text-amber-600 mt-1">
                  Minimum deposit for {RESIDENCY_LABELS[residency]} on properties ≥ AED 5M is {minDeposit}% — floor updated automatically.
                </p>
              )}
            </div>

            <EditableSlider
              label="Interest rate (p.a.)"
              value={interestRate} min={2} max={8} step={0.05}
              sliderLabel="Interest rate slider"
              inputSuffix="%"
              decimalPlaces={2}
              onChange={setInterestRate}
            />

            <TermSlider value={termYears} onChange={setTermYears} />
          </div>
        </div>

        {/* Key outputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 mb-1">Monthly payment</p>
            <p className="text-3xl font-bold text-gray-900">AED {fmt(monthlyPayment)}</p>
            <p className="text-xs text-gray-400 mt-1">principal + interest · {termYears} yr term</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 col-span-2 sm:col-span-1">
            <p className="text-xs text-gray-400 mb-1">LTV ratio</p>
            <p className="text-3xl font-bold text-gray-900">{ltv}%</p>
            <p className="text-xs text-gray-400 mt-1">loan AED {fmt(loanAmount)}</p>
          </div>
        </div>

        {/* Upfront costs */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Upfront costs</p>
          <div>
            {/* Purchase price — reference row */}
            <div className="flex justify-between items-center py-2 pb-3 mb-1 border-b border-gray-100">
              <span className="text-sm text-gray-400">Purchase price</span>
              <span className="text-sm text-gray-400 tabular-nums">AED {fmt(price)}</span>
            </div>

            {/* Cash items */}
            {[
              {
                label:   'Deposit',
                tooltip: `${depositPct}% of purchase price — the cash portion you pay upfront, with the remainder covered by your mortgage.`,
                value:   `AED ${fmt(depositAmount)}`,
              },
              {
                label:   'Land department fee',
                tooltip: '4% of purchase price + AED 580 government admin fee. Payable to the Dubai Land Department to transfer ownership.',
                value:   `AED ${fmt(dldFee)}`,
              },
              {
                label:   'Trustee office fee',
                tooltip: price < 500000
                  ? 'AED 2,000 + 5% VAT — applies to properties under AED 500,000. Payable to the DLD-registered trustee office handling the transfer.'
                  : 'AED 4,000 + 5% VAT — applies to properties AED 500,000 and above. Payable to the DLD-registered trustee office handling the transfer.',
                value:   `AED ${fmt(trusteeFee)}`,
              },
              {
                label:   'Mortgage registration fee',
                tooltip: '0.25% of the loan amount — a government fee to register the mortgage with the Dubai Land Department.',
                value:   `AED ${fmt(mortgageRegFee)}`,
              },
              {
                label:   'Bank arrangement fee',
                tooltip: '0% to 1% of the loan amount + 5% VAT — charged by the lender to set up the mortgage.',
                value:   `up to AED ${fmt(arrangementHigh)}`,
                isRange: true,
              },
              {
                label:   'Mortgage valuation fee',
                tooltip: 'Fixed fee charged by the bank to commission an independent valuation of the property before approving the mortgage.',
                value:   `AED ${fmt(valuationFee)}`,
              },
              {
                label:   'Real estate agency fee',
                tooltip: '2% of purchase price + 5% VAT — payable to the buyer\'s or seller\'s agent. Standard in Dubai.',
                value:   `AED ${fmt(agencyTotal)}`,
              },
            ].map(({ label, tooltip, value, isRange }, i) => (
              <div key={i} className={`flex justify-between items-center py-2.5 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                <span className="flex items-center text-sm text-gray-600">
                  {label}
                  <Tooltip text={tooltip} />
                </span>
                <span className={`text-sm font-semibold tabular-nums ${isRange ? 'text-gray-500' : 'text-gray-900'}`}>
                  {value}
                </span>
              </div>
            ))}

            {/* Total */}
            <div className="mt-3 pt-3 border-t-2 border-gray-200">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-gray-800">Total amount required upfront</span>
                <span className="text-sm font-bold text-gray-900 tabular-nums">
                  AED {fmt(upfrontLow)} – {fmt(upfrontHigh)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Upper end assumes bank arrangement fee of 1%. All other figures are fixed for these inputs.
              </p>
            </div>

            {/* Monthly payment */}
            <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Monthly payment (principal + interest)</span>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">AED {fmt(monthlyPayment)} / mo</span>
            </div>
          </div>
        </div>

        <div className="text-center pb-4">
          <Link href="/calculators/investment" className="text-sm text-gray-600 hover:text-gray-900 transition-colors underline">
            ← Back to investment calculator
          </Link>
        </div>
      </div>
    </div>
  )
}
