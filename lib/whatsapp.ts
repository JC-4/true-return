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
