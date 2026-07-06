'use client'

import { useState } from 'react'

export interface LeadGenFormData {
  name: string
  email: string
  phone: string
  budget: string
  timeline: string
  message: string
  project: string
}

interface Props {
  projectName: string
  onSubmit: (data: LeadGenFormData) => void
}

const BUDGET_OPTIONS = [
  'Under AED 2M',
  'AED 2M–5M',
  'AED 5M–10M',
  'AED 10M+',
]

const TIMELINE_OPTIONS = [
  'Within 1 month',
  '1–3 months',
  '3–6 months',
  '6–12 months',
]

const inputCls = (error: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-brand-text bg-white focus:outline-none focus:ring-1 placeholder:text-brand-hint transition-colors ${
    error
      ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
      : 'border-brand-border focus:ring-brand-bronze focus:border-brand-bronze'
  }`

const BRONZE = '#A0784A'

export default function LeadGenForm({ projectName, onSubmit }: Props) {
  const [step, setStep]         = useState<1 | 2>(1)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [budget, setBudget]     = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage]   = useState('')
  const [errors, setErrors]     = useState<Partial<Record<'name' | 'email' | 'phone' | 'budget' | 'timeline', string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validateStep1() {
    const next: typeof errors = {}
    if (!name.trim())  next.name  = 'Name is required'
    if (!email.trim()) next.email = 'Email is required'
    if (!phone.trim()) next.phone = 'Phone / WhatsApp is required'
    return next
  }

  function validateStep2() {
    const next: typeof errors = {}
    if (!budget)   next.budget   = 'Please select a budget range'
    if (!timeline) next.timeline = 'Please select a timeline'
    return next
  }

  function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    const next = validateStep1()
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})
    setStep(2)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateStep2()
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    const data: LeadGenFormData = {
      name:     name.trim(),
      email:    email.trim(),
      phone:    phone.trim(),
      budget,
      timeline,
      message:  message.trim(),
      project:  projectName,
    }

    onSubmit(data)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#F4F3F0' }}>
          <svg className="w-6 h-6 text-brand-bronze" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-brand-text">Thanks — we'll be in touch shortly.</p>
      </div>
    )
  }

  const pillBase: React.CSSProperties = { width: 24, height: 4, borderRadius: 9999 }

  return (
    <form onSubmit={step === 1 ? handleContinue : handleSubmit} noValidate className="space-y-4">

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ ...pillBase, backgroundColor: BRONZE }} />
          <div style={{ ...pillBase, backgroundColor: step === 2 ? BRONZE : 'var(--brand-border)' }} />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide text-brand-muted">
          Step {step} of 2
        </span>
      </div>

      {step === 1 ? (
        <>
          <div>
            <h3 className="text-base font-semibold text-brand-text">Interested in {projectName}?</h3>
            <p className="text-sm text-brand-muted mt-0.5">Share your details and we'll send you the analysis.</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: undefined })) }}
              placeholder="Your full name"
              className={inputCls(!!errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
              placeholder="you@example.com"
              className={inputCls(!!errors.email)}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">
              Phone / WhatsApp <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={e => { setPhone(e.target.value); if (errors.phone) setErrors(p => ({ ...p, phone: undefined })) }}
              placeholder="+971 50 000 0000"
              className={inputCls(!!errors.phone)}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
          >
            Continue →
          </button>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-base font-semibold text-brand-text">One more thing</h3>
            <p className="text-sm text-brand-muted mt-0.5">Help us tailor the analysis to your situation.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1.5">
                Budget <span className="text-red-400">*</span>
              </label>
              <select
                value={budget}
                onChange={e => { setBudget(e.target.value); if (errors.budget) setErrors(p => ({ ...p, budget: undefined })) }}
                className={inputCls(!!errors.budget)}
              >
                <option value="">Select a range</option>
                {BUDGET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.budget && <p className="mt-1 text-xs text-red-500">{errors.budget}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-muted mb-1.5">
                Purchase timeline <span className="text-red-400">*</span>
              </label>
              <select
                value={timeline}
                onChange={e => { setTimeline(e.target.value); if (errors.timeline) setErrors(p => ({ ...p, timeline: undefined })) }}
                className={inputCls(!!errors.timeline)}
              >
                <option value="">Select a timeline</option>
                {TIMELINE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              {errors.timeline && <p className="mt-1 text-xs text-red-500">{errors.timeline}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">
              What are you looking for?
              <span className="ml-1 font-normal text-brand-hint">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us a bit about what you're looking for"
              rows={4}
              className={`${inputCls(false)} resize-none`}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 py-3 rounded-lg transition-colors"
          >
            Send enquiry
          </button>

          <button
            type="button"
            onClick={() => { setErrors({}); setStep(1) }}
            className="w-full text-center text-xs text-brand-muted hover:text-brand-text transition-colors mt-1"
          >
            ← Back
          </button>
        </>
      )}
    </form>
  )
}
