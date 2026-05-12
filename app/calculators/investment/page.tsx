import { Suspense } from 'react'
import CalculatorClient from './CalculatorClient'

export default function CalculatorPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#fafafa] min-h-screen flex items-center justify-center">
          <p className="text-[#71717a] text-sm">Loading calculator…</p>
        </div>
      }
    >
      <CalculatorClient />
    </Suspense>
  )
}
