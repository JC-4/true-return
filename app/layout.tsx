import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'

export const metadata: Metadata = {
  /* PLACEHOLDER: Update title and description to match your brand */
  title: 'TrueReturn — Dubai Property Investment',
  description: 'Independent buyer\'s agent helping sophisticated investors find high-yield Dubai property.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#fafafa] text-[#18181b] antialiased min-h-screen">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
