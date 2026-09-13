'use client'

import { useState } from 'react'
import {
  BUDGET_OPTIONS,
  TIMELINE_OPTIONS,
  inputCls,
  WhatsappLink,
  enquiryMessageFor,
  type PendingLead,
} from '@/components/LeadFormShared'

/**
 * What used to be step 2, now living on /thank-you.
 *
 * The lead already exists by the time this renders — step 1's POST created it
 * — so everything here is enrichment. It PATCHes budget, timeline and message
 * onto the existing lead_id.
 */
export default function LeadQualifyForm({ lead, onDone }: {
  lead: PendingLead
  onDone: () => void
}) {
  const [budget, setBudget]     = useState('')
  const [timeline, setTimeline] = useState('')
  const [message, setMessage]   = useState('')
  const [errors, setErrors]     = useState<Partial<Record<'budget' | 'timeline', string>>>({})
  const [loading, setLoading]   = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!budget)   next.budget   = 'Please select a budget range'
    if (!timeline) next.timeline = 'Please select a timeline'
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})
    setSendError(null)

    // Belt and braces: this only renders with a lead in hand. A PATCH carrying
    // a null lead_id would create an orphan 'completed' event in Make.
    if (!lead.leadId) {
      setSendError('Your details were not saved. Please start again or message us directly.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id:  lead.leadId,
          budget,
          timeline,
          message:  message.trim(),
        }),
      })
      if (!res.ok) {
        // Read the body: a 429 carries the wait time, which is the whole point
        // of rejecting clearly rather than showing a generic failure.
        const data = await res.json().catch(() => ({})) as { error?: string }
        setSendError(data.error ?? "We couldn't attach those details to your enquiry.")
        return
      }
      onDone()
    } catch {
      setSendError('Network error — those details were not sent.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-brand-text">One more thing</h2>
        <p className="text-sm text-brand-muted mt-0.5">
          Optional, but it helps us tailor the analysis before we call.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Budget <span className="text-brand-neg">*</span>
          </label>
          <select
            value={budget}
            onChange={e => { setBudget(e.target.value); if (errors.budget) setErrors(p => ({ ...p, budget: undefined })) }}
            className={inputCls(!!errors.budget)}
          >
            <option value="">Select a range</option>
            {BUDGET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {errors.budget && <p className="mt-1 text-xs text-brand-neg">{errors.budget}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-muted mb-1.5">
            Purchase timeline <span className="text-brand-neg">*</span>
          </label>
          <select
            value={timeline}
            onChange={e => { setTimeline(e.target.value); if (errors.timeline) setErrors(p => ({ ...p, timeline: undefined })) }}
            className={inputCls(!!errors.timeline)}
          >
            <option value="">Select a timeline</option>
            {TIMELINE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          {errors.timeline && <p className="mt-1 text-xs text-brand-neg">{errors.timeline}</p>}
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
          className="flex-1 min-h-[48px] btn-primary text-sm font-medium px-5 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send these details'}
        </button>
        <WhatsappLink
          message={enquiryMessageFor(lead.projectName, lead.isProjectPage)}
          context={lead.source}
        />
      </div>

      {sendError && (
        <div className="rounded-lg border border-brand-neg bg-brand-neg-soft p-4">
          <p className="text-sm font-semibold text-brand-neg">{sendError}</p>
          <p className="text-xs text-brand-neg mt-1">
            Your enquiry itself did land — this only adds detail to it. Press the
            button again, or use the WhatsApp link beside it.
          </p>
        </div>
      )}
    </form>
  )
}
