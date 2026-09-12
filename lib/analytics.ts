// Google tag wiring. Every id comes from a NEXT_PUBLIC_ var so nothing is
// baked into the source, and each piece degrades independently: no GA id means
// no GA, no Ads id means no conversions, and the rest still works.
//
// Read at module scope. Next inlines NEXT_PUBLIC_ vars at build time, so a
// dynamic process.env[name] lookup would not be replaced and would come back
// undefined in the browser.

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || null

/** Google Ads conversion labels. A conversion needs `AW-XXX/label`, so the
 *  label is per-action and lives alongside the account id. */
const LEAD_LABEL = process.env.NEXT_PUBLIC_GADS_LEAD_LABEL || null
const WHATSAPP_LABEL = process.env.NEXT_PUBLIC_GADS_WHATSAPP_LABEL || null

/** The tag is only injected in production — see components/Analytics.tsx — so
 *  a dev session never appears in the property or spends a conversion. */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/** True when there is something to load at all. */
export const analyticsEnabled = IS_PRODUCTION && Boolean(GA_MEASUREMENT_ID || GOOGLE_ADS_ID)

type GtagArgs =
  | [command: 'event', eventName: string, params?: Record<string, unknown>]
  | [command: 'config', targetId: string, params?: Record<string, unknown>]
  | [command: 'js', config: Date]

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: GtagArgs) => void
  }
}

function gtag(...args: GtagArgs) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag(...args)
}

/** `AW-123456789/AbCdEfg` — null when either half is missing. */
function sendTo(label: string | null): string | null {
  if (!GOOGLE_ADS_ID || !label) return null
  return `${GOOGLE_ADS_ID}/${label}`
}

export type ConversionName = 'lead_submitted' | 'whatsapp_click'

const LABELS: Record<ConversionName, string | null> = {
  lead_submitted: LEAD_LABEL,
  whatsapp_click: WHATSAPP_LABEL,
}

/**
 * Records a conversion.
 *
 * Outside production this only logs what it would have sent — the tag is not
 * on the page, so firing would be a no-op anyway, and seeing the payload is
 * how you check the wiring without touching the live numbers.
 *
 * Sends twice on purpose when both are configured: a GA4 event for reporting
 * and a Google Ads conversion for bidding. They are separate destinations.
 */
export function trackConversion(name: ConversionName, params: Record<string, unknown> = {}) {
  if (!IS_PRODUCTION) {
    console.info('[analytics] would send conversion (skipped outside production):', name, params)
    return
  }

  if (GA_MEASUREMENT_ID) gtag('event', name, params)

  const target = sendTo(LABELS[name])
  if (target) gtag('event', 'conversion', { send_to: target, ...params })
}
