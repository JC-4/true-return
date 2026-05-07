import { Suspense } from 'react'
import CalculatorClient from './CalculatorClient'

export default function CalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-navy-950 min-h-screen flex items-center justify-center">
          <p className="text-navy-100 text-sm">Loading calculator…</p>
        </div>
      }
    >
      <CalculatorClient />
    </Suspense>
  )
}
