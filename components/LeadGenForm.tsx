'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  inputCls,
  WhatsappLink,
  enquiryMessageFor,
  PENDING_LEAD_KEY,
  type PendingLead,
} from '@/components/LeadFormShared'

/** What the form promises to send back. The button that opened the form has
 *  already made a promise to the reader; this keeps the form making the same
 *  one, instead of offering "the analysis" under a button that offered prices. */
export type LeadFormVariant =
  | 'prices'
  | 'prices-on-release'
  | 'follow-up'
  | 'honest-read'
  | 'analysis'

const SUBCOPY: Record<LeadFormVariant, string> = {
  prices:              "Share your details and we'll send current prices and what's available.",
  'prices-on-release': "Share your details and we'll send prices and availability as soon as they're released.",
  'follow-up':         "Share your details and we'll come back to you on this one.",
  'honest-read':       "Share your details and we'll come back with an honest read on this project.",
  analysis:            "Share your details and we'll send you the analysis.",
}

interface Props {
  projectName: string
  isProjectPage?: boolean
  /** Where the form was submitted from. Passed straight through to /api/leads. */
  source?: string
  variant?: LeadFormVariant
  /** Set only when the form is inside the lead dialog, which names itself from
   *  this heading. The inline copy of the form leaves it unset: both render on
   *  the project page at once, and a duplicated id would point the dialog's
   *  `aria-labelledby` at whichever came first in the document. */
  headingId?: string
}

/**
 * Captures the lead, then hands off to /thank-you.
 *
 * This is the step that matters: the POST creates the lead, so a visitor who
 * gets past it has converted whether or not they answer anything else. The
 * qualifying questions that used to render here in place now live on
 * /thank-you, which is also where the conversion fires.
 */
export default function LeadGenForm({ projectName, isProjectPage = true, source = 'Footer form', variant = 'analysis', headingId }: Props) {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  /** Honeypot. Hidden from people, so a non-empty value means a bot. Kept
   *  in state like any other field so React owns the input. */
  const [contactRef, setContactRef] = useState('')
  const [errors, setErrors]     = useState<Partial<Record<'name' | 'email' | 'phone', string>>>({})
  const [loading, setLoading]   = useState(false)
  /** Set when a request to /api/leads fails. The enquiry did not land, so the
   *  form stays put and offers WhatsApp as the way through. */
  const [sendError, setSendError] = useState<string | null>(null)

  const enquiryMessage = enquiryMessageFor(projectName, isProjectPage)

  function validate() {
    const next: typeof errors = {}
    if (!name.trim())  next.name  = 'Name is required'
    if (!email.trim()) next.email = 'Email is required'
    if (!phone.trim()) next.phone = 'Phone / WhatsApp is required'
    return next
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next = validate()
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
      // Routing on would land the visitor on a thank-you page, and fire a
      // conversion, for an enquiry that never arrived. Stay put instead.
      if (!res.ok || !data.lead_id) {
        setSendError(data.error ?? "We couldn't send that just now.")
        return
      }

      const pending: PendingLead = { leadId: data.lead_id, projectName, isProjectPage, source }
      try {
        sessionStorage.setItem(PENDING_LEAD_KEY, JSON.stringify(pending))
      } catch {
        // Private mode or blocked storage. The lead is already recorded, so
        // /thank-you still confirms — it just cannot offer the extra questions.
      }
      router.push('/thank-you')
    } catch {
      setSendError('Network error — your enquiry was not sent.')
    } finally {
      setLoading(false)
    }
  }

  const pillBase: React.CSSProperties = { width: 24, height: 4, borderRadius: 9999 }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">

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

      {/* Still two steps; the second one is on the next page. */}
      <div className="flex items-center gap-2">
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ ...pillBase, backgroundColor: 'var(--c-accent)' }} />
          <div style={{ ...pillBase, backgroundColor: 'var(--c-border)' }} />
        </div>
        <span className="text-xs font-medium text-brand-muted">
          Step 1 of 2
        </span>
      </div>

      <div>
        <h3 id={headingId} className="text-base font-semibold text-brand-text">Interested in {projectName}?</h3>
        <p className="text-sm text-brand-muted mt-0.5">{SUBCOPY[variant]}</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-brand-muted mb-1.5">
          Name <span className="text-brand-neg">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: undefined })) }}
          placeholder="Your full name"
          className={inputCls(!!errors.name)}
        />
        {errors.name && <p className="mt-1 text-xs text-brand-neg">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-brand-muted mb-1.5">
          Email <span className="text-brand-neg">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })) }}
          placeholder="you@example.com"
          className={inputCls(!!errors.email)}
        />
        {errors.email && <p className="mt-1 text-xs text-brand-neg">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-brand-muted mb-1.5">
          Phone / WhatsApp <span className="text-brand-neg">*</span>
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
        {errors.phone && <p className="mt-1 text-xs text-brand-neg">{errors.phone}</p>}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 min-h-[48px] btn-primary text-sm font-medium px-5 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Please wait…' : 'Continue →'}
        </button>
        <WhatsappLink message={enquiryMessage} context={source} />
      </div>

      {sendError && (
        <div className="rounded-lg border border-brand-neg bg-brand-neg-soft p-4">
          <p className="text-sm font-semibold text-brand-neg">{sendError}</p>
          <p className="text-xs text-brand-neg mt-1">
            Your details are still filled in — press the button again, or use the WhatsApp link beside it.
          </p>
        </div>
      )}
    </form>
  )
}
