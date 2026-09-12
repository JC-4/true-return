'use client'

import { whatsappLinkProps } from '@/lib/whatsapp'

/** Handed from the lead form to /thank-you through sessionStorage rather than
 *  the URL — a lead id in a query string leaks into referrers and analytics. */
export type PendingLead = {
  leadId: string
  projectName: string
  isProjectPage: boolean
  source: string
}

export const PENDING_LEAD_KEY = 'tr:pending-lead'

export const BUDGET_OPTIONS = [
  'Under AED 2M',
  'AED 2M–5M',
  'AED 5M–10M',
  'AED 10M+',
]

export const TIMELINE_OPTIONS = [
  'Within 1 month',
  '1–3 months',
  '3–6 months',
  '6–12 months',
]

export const inputCls = (error: boolean) =>
  `w-full border rounded-lg px-3 py-2.5 text-sm text-brand-text bg-white focus:outline-none focus:ring-1 placeholder:text-brand-hint transition-colors ${
    error
      ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
      : 'border-brand-border focus:ring-brand-bronze focus:border-brand-bronze'
  }`

/** Secondary route to the same conversation, sat beside a submit button.
 *  Renders nothing when NEXT_PUBLIC_WHATSAPP_NUMBER is unset — better than a
 *  wa.me link that goes nowhere. Kept at 48px tall so it is still a real tap
 *  target on a phone despite reading as a link. The conversion hook lives in
 *  lib/whatsapp, so every one of these reports the same way. */
export function WhatsappLink({ message, label = 'or WhatsApp', context }: {
  message: string
  label?: string
  context: string
}) {
  const props = whatsappLinkProps(message, context)
  if (!props) return null
  return (
    <a
      {...props}
      className="inline-flex items-center justify-center min-h-[48px] whitespace-nowrap text-sm font-medium text-brand-muted hover:text-brand-text underline underline-offset-4 decoration-brand-border hover:decoration-brand-text transition-colors"
    >
      {label}
    </a>
  )
}

export function enquiryMessageFor(projectName: string, isProjectPage: boolean) {
  return isProjectPage
    ? `Hi, I'm interested in more information about ${projectName}.`
    : "Hi, I'm looking to invest in UAE property and would like some more information."
}
