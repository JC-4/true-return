import type { Metadata } from 'next'
import { Schibsted_Grotesk, Instrument_Serif } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import Analytics from '@/components/Analytics'

const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-schibsted-grotesk',
})

/* Used in one place only: the project name in the /projects/[slug] hero. */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
})

export const metadata: Metadata = {
  title: 'Offplan Source — UAE Property Investment',
  description: 'Independent buyer\'s agent helping sophisticated investors find high-yield UAE property.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${schibstedGrotesk.variable} ${instrumentSerif.variable}`}>
      <body className="bg-brand-bg text-brand-text antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
