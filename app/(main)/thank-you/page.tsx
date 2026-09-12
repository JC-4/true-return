import type { Metadata } from 'next'
import ThankYouClient from './ThankYouClient'

/** Not a landing page and not something to surface in search — it only makes
 *  sense immediately after submitting the form, and an indexed thank-you page
 *  is a classic source of phantom conversions. */
export const metadata: Metadata = {
  title: 'Thank you — TrueReturn',
  robots: { index: false, follow: false },
}

export default function ThankYouPage() {
  return <ThankYouClient />
}
