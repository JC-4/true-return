import type { Metadata } from 'next'
import { Schibsted_Grotesk } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'
import Analytics from '@/components/Analytics'

const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-schibsted-grotesk',
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
    <html lang="en" className={schibstedGrotesk.variable}>
      <body className="bg-brand-bg text-brand-text antialiased min-h-screen">
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
