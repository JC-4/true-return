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

export default function LeadGenForm({ projectName, onSubmit }: Props) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [budget, setBudget]     = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage]   = useState('')
  const [errors, setErrors]     = useState<Partial<Record<'name' | 'email' | 'phone' | 'budget' | 'timeline', string>>>({})
  const [submitted, setSubmitted] = useState(false)

  function validate() {
    const next: typeof errors = {}
    if (!name.trim())     next.name     = 'Name is required'
    if (!email.trim())    next.email    = 'Email is required'
    if (!phone.trim())    next.phone    = 'Phone / WhatsApp is required'
    if (!budget)          next.budget   = 'Please select a budget range'
    if (!timeline)        next.timeline = 'Please select a timeline'
    return next
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = validate()
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }
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

    // TODO: wire submission to backend (e.g. Supabase insert or API route)
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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Hidden project field */}
      <input type="hidden" name="project" value={projectName} />

      {/* Name */}
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

      {/* Email */}
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

      {/* Phone */}
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

      {/* Budget + Timeline — side by side on wider screens */}
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

      {/* Message — optional */}
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
    </form>
  )
}
