import { trackConversion } from '@/lib/analytics'

// Single source for the click-to-chat number. NEXT_PUBLIC_ so client
// components can read it — it is a published contact number, not a secret.
//
// Read at module scope: Next inlines NEXT_PUBLIC_ vars at build time, so a
// dynamic `process.env[name]` lookup would not be replaced and would come back
// undefined in the browser.
const NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, '') || null

/** Digits only, no `+`. Null when unset — callers hide the affordance rather
 *  than render a wa.me link that goes nowhere. */
export const WHATSAPP_NUMBER = NUMBER

/** Click-to-chat URL with an optional prefilled message. Null when unset. */
export function whatsappHref(message?: string): string | null {
  if (!NUMBER) return null
  return message
    ? `https://wa.me/${NUMBER}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${NUMBER}`
}

/**
 * Everything a click-to-chat link needs, including the conversion hook.
 *
 * The tracking lives here rather than in each link component so there is one
 * place to change what a WhatsApp click reports. Returns null when the number
 * is unset, so callers keep the existing "render nothing" branch.
 *
 * `context` labels where the click came from — it rides along on the event so
 * a brochure enquiry and a footer enquiry are distinguishable in reporting.
 */
export function whatsappLinkProps(message: string, context: string): {
  href: string
  target: '_blank'
  rel: string
  onClick: () => void
} | null {
  const href = whatsappHref(message)
  if (!href) return null
  return {
    href,
    target: '_blank',
    rel: 'noopener',
    // Not awaited and not blocking navigation: the link opens a new tab either
    // way, and a conversion is not worth delaying the thing the visitor asked
    // for. gtag batches and flushes its own queue.
    onClick: () => trackConversion('whatsapp_click', { context }),
  }
}
