'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { withPreview } from '@/lib/preview'
import type { ShortlistStep } from '@/lib/shortlist'

const norm = (s: string) => decodeURIComponent(s).replace(/\/+$/, '')

// Reads as page numbers, not controls: no pills, borders or fills — the
// return analysis panel has its own floating pill nav on screen at the same
// time, and a second pill-shaped thing would read as one broken control.
// Labels truncate on narrow screens rather than collapsing behind a tap;
// seeing your position at a glance is the whole point.
export default function ShortlistStepper({ steps }: { steps: ShortlistStep[] }) {
  const pathname = usePathname()
  // Layouts can't read searchParams, so preview mode is picked up here and
  // carried onto every step link
  const preview = useSearchParams().get('preview') === '1'
  const current = norm(pathname)

  if (steps.length <= 1) return null

  return (
    <nav aria-label="Shortlist contents" className="bg-white border-b border-brand-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-10">
        <ol className="flex items-baseline gap-4 sm:gap-7 py-3">
          {steps.map(step => {
            const isCurrent = norm(step.href) === current
            return (
              <li key={step.href} className="min-w-0">
                <Link
                  href={withPreview(step.href, preview)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="flex items-baseline gap-1.5 min-w-0 transition-colors"
                >
                  <span
                    className="text-[11px] tabular-nums flex-shrink-0"
                    style={{ color: isCurrent ? '#A0784A' : '#9B9589' }}
                  >
                    {step.n}
                  </span>
                  <span
                    className={`text-xs sm:text-sm truncate ${
                      isCurrent ? 'text-brand-text font-medium' : 'text-brand-hint hover:text-brand-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
