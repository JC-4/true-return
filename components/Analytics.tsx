import Script from 'next/script'
import { GA_MEASUREMENT_ID, GOOGLE_ADS_ID, analyticsEnabled } from '@/lib/analytics'

/**
 * The Google tag, site-wide.
 *
 * Renders nothing outside production, so a dev session never reaches the
 * property and never spends a conversion. `afterInteractive` keeps it off the
 * critical path — it loads once the page is usable, which is soon enough for
 * a pageview and well before anyone can click a CTA.
 *
 * A single gtag.js load serves both destinations; each id then gets its own
 * config line. The src uses whichever id exists, since either can be absent.
 */
export default function Analytics() {
  if (!analyticsEnabled) return null

  const primaryId = GA_MEASUREMENT_ID ?? GOOGLE_ADS_ID

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}');` : ''}
          ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ''}
        `}
      </Script>
    </>
  )
}
