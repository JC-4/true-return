'use client'

import { useState } from 'react'
import { whatsappHref } from '@/lib/whatsapp'

interface Props {
  projectName: string
  isProjectPage?: boolean
  /** Where the form was submitted from. Passed straight through to /api/leads. */
  source?: string
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

/** Secondary route to the same conversation, sat beside the submit button.
 *  Renders nothing when NEXT_PUBLIC_WHATSAPP_NUMBER is unset — better than a
 *  wa.me link that goes nowhere. Kept at 48px tall so it is still a real tap
 *  target on a phone despite reading as a link. */
function WhatsappLink({ message, label = 'or WhatsApp' }: { message: string; label?: string }) {
  const href = whatsappHref(message)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center justify-center min-h-[48px] whitespace-nowrap text-sm font-medium text-brand-muted hover:text-brand-text underline underline-offset-4 decoration-brand-border hover:decoration-brand-text transition-colors"
    >
      {label}
    </a>
  )
}

export default function LeadGenForm({ projectName, isProjectPage = true, source = 'Footer form' }: Props) {
  const [step, setStep]         = useState<1 | 2>(1)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [budget, setBudget]     = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage]   = useState('')
  const [leadId, setLeadId]     = useState<string | null>(null)
  /** Honeypot. Hidden from people, so a non-empty value means a bot. Kept
   *  in state like any other field so React owns the input. */
  const [contactRef, setContactRef] = useState('')
  const [errors, setErrors]     = useState<Partial<Record<'name' | 'email' | 'phone' | 'budget' | 'timeline', string>>>({})
  const [loading, setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)
  /** Set when a request to /api/leads fails. The enquiry did not land, so the
   *  form stays put and offers WhatsApp as the way through. */
  const [sendError, setSendError] = useState<string | null>(null)

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

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    const next = validateStep1()
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})
    setSendError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:         name.trim(),
          email:        email.trim(),
          phone:        phone.trim(),
          // Misleading field name: this carries the display name, not the slug.
          // A live Make scenario feeds it into Airtable, so the behaviour stays.
          project_slug: projectName,
          source,
          referrer:     typeof document !== 'undefined' ? document.referrer : '',
          contact_reference: contactRef,
        }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; lead_id?: string; error?: string }
      // No lead_id means nothing was recorded, whatever the status code says.
      // Advancing here would collect budget and timeline with no lead to
      // attach them to, and end on a success screen for an enquiry that never
      // arrived. Stay on step 1 instead.
      if (!res.ok || !data.lead_id) {
        setSendError(data.error ?? "We couldn't send that just now.")
        return
      }
      setLeadId(data.lead_id)
      setStep(2)
    } catch {
      setSendError('Network error — your enquiry was not sent.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = validateStep2()
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})
    setSendError(null)

    // Belt and braces: step 1 only advances once a lead_id is in hand, so this
    // should be unreachable. A PATCH carrying lead_id: null would create an
    // orphan 'completed' event in Make with nothing to match it to.
    if (!leadId) {
      setSendError('Your details were not saved. Please start again or message us directly.')
      setStep(1)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id:  leadId,
          budget,
          timeline,
          message:  message.trim(),
        }),
      })
      if (!res.ok) {
        // Read the body: a 429 carries the wait time, which is the whole
        // point of rejecting clearly rather than showing a generic failure.
        const data = await res.json().catch(() => ({})) as { error?: string }
        setSendError(data.error ?? "We couldn't attach those details to your enquiry.")
        return
      }
      setSubmitted(true)
    } catch {
      setSendError('Network error — those details were not sent.')
    } finally {
      setLoading(false)
    }
  }

  const enquiryMessage = isProjectPage
    ? `Hi, I'm interested in more information about ${projectName}.`
    : "Hi, I'm looking to invest in UAE property and would like some more information."

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
        <WhatsappLink message={enquiryMessage} label="Message me on WhatsApp" />
      </div>
    )
  }

  const pillBase: React.CSSProperties = { width: 24, height: 4, borderRadius: 9999 }

  return (
    <form onSubmit={step === 1 ? handleContinue : handleSubmit} noValidate className="space-y-4">

      {/* Honeypot. Positioned off-screen rather than display:none, which more
          bots know to skip, and hidden from assistive tech and the tab order
          so nobody reaches it by accident. A neutral name keeps browser and
          password-manager autofill away from it — an autofilled honeypot would
          silently bin a real enquiry. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label htmlFor="contact-reference">Contact reference (leave blank)</label>
        <input
          id="contact-reference"
          name="contact_reference"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-lpignore="true"
          data-1p-ignore
          value={contactRef}
          onChange={e => setContactRef(e.target.value)}
        />
      </div>

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
              inputMode="tel"
              value={phone}
              onChange={e => {
                const raw = e.target.value
                const filtered = (raw.startsWith('+') ? '+' : '') + raw.replace(/[^\d\s]/g, '').replace(/^\s+/, '')
                setPhone(filtered)
                if (errors.phone) setErrors(p => ({ ...p, phone: undefined }))
              }}
              placeholder="+971 50 000 0000"
              className={inputCls(!!errors.phone)}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[48px] bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Please wait…' : 'Continue →'}
            </button>
            <WhatsappLink message={enquiryMessage} />
          </div>
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

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[48px] bg-brand-bronze hover:bg-brand-bronze/90 text-white text-sm font-medium px-5 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send enquiry'}
            </button>
            <WhatsappLink message={enquiryMessage} />
          </div>

        </>
      )}

      {sendError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-sm font-semibold text-red-700">{sendError}</p>
            <p className="text-xs text-red-600 mt-1">
              Your details are still filled in — press the button again, or use the WhatsApp link beside it.
            </p>
          </div>
        </div>
      )}
    </form>
  )
}
