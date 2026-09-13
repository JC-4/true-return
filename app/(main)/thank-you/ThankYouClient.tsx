'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import LeadQualifyForm from '@/components/LeadQualifyForm'
import { PENDING_LEAD_KEY, type PendingLead } from '@/components/LeadFormShared'
import { trackConversion } from '@/lib/analytics'

/** Marks a lead as already counted, so a refresh of this page does not fire a
 *  second conversion for the same enquiry. */
const FIRED_KEY = 'tr:conversion-fired-for'

const NEXT_STEPS = [
  'We read your enquiry and pull the numbers on the project you asked about.',
  'You get an independent analysis by email — yield, financing and exit, with the assumptions shown.',
  'If it is worth a conversation, we call. No obligation, and no cost to you.',
]

export default function ThankYouClient() {
  const [lead, setLead] = useState<PendingLead | null>(null)
  const [ready, setReady] = useState(false)
  const [qualified, setQualified] = useState(false)
  const fired = useRef(false)

  useEffect(() => {
    let pending: PendingLead | null = null
    try {
      const raw = sessionStorage.getItem(PENDING_LEAD_KEY)
      if (raw) pending = JSON.parse(raw) as PendingLead
    } catch {
      // Blocked or malformed storage — fall through to the plain confirmation.
    }
    setLead(pending)
    setReady(true)

    // Only count a conversion when a lead actually got here from the form.
    // Someone opening /thank-you directly, or a crawler that ignores noindex,
    // has not converted, and counting them would corrupt the bidding data.
    if (!pending || fired.current) return
    let alreadyFired: string | null = null
    try { alreadyFired = sessionStorage.getItem(FIRED_KEY) } catch { /* ignore */ }
    if (alreadyFired === pending.leadId) return

    fired.current = true
    try { sessionStorage.setItem(FIRED_KEY, pending.leadId) } catch { /* ignore */ }
    trackConversion('lead_submitted', {
      source: pending.source,
      project: pending.projectName,
    })
  }, [])

  function handleQualified() {
    setQualified(true)
    try { sessionStorage.removeItem(PENDING_LEAD_KEY) } catch { /* ignore */ }
  }

  return (
    <div className="theme-os bg-brand-bg min-h-screen">
      <div className="px-6 sm:px-10 py-16 sm:py-24">
        <div style={{ maxWidth: 600, margin: '0 auto' }}>

          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-brand-pos-soft">
              <svg className="w-6 h-6 text-brand-pos" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-brand-muted mb-3">Enquiry received</p>
            <h1 className="text-2xl font-semibold text-brand-text mb-2">
              {lead?.isProjectPage && lead.projectName
                ? `Thanks — we've got your enquiry about ${lead.projectName}.`
                : "Thanks — we've got your enquiry."}
            </h1>
            <p className="text-sm text-brand-muted">
              Nothing else is needed from you. Here is what happens next.
            </p>
          </div>

          <ol className="mt-10 space-y-4">
            {NEXT_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="btn-primary flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold mt-0.5"
                >
                  {i + 1}
                </span>
                <span className="text-sm text-brand-muted leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>

          {/* Step 2, relocated. Only offered when we know which lead to attach
              it to; the enquiry is already complete without it. */}
          {ready && lead && !qualified && (
            <div className="mt-12 pt-10 border-t border-brand-border">
              <LeadQualifyForm lead={lead} onDone={handleQualified} />
            </div>
          )}

          {qualified && (
            <div className="mt-12 pt-10 border-t border-brand-border text-center">
              <p className="text-sm font-semibold text-brand-text">Got it — that helps, thank you.</p>
              <p className="text-sm text-brand-muted mt-1">We&apos;ll factor it into the analysis.</p>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-brand-border text-center">
            <p className="text-sm text-brand-muted mb-4">In the meantime, keep looking.</p>
            <Link
              href="/projects"
              className="btn-primary inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg text-sm font-semibold"
            >
              Browse projects
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
