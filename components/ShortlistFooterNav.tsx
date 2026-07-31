import Link from 'next/link'
import type { ShortlistStep } from '@/lib/shortlist'

const norm = (s: string) => decodeURIComponent(s).replace(/\/+$/, '')

// Sequential movement through the document — the primary motion. The header
// stepper handles jumping around. Same component on every page so previous/
// next behave identically wherever the reader is.
export default function ShortlistFooterNav({ steps, currentHref }: {
  steps: ShortlistStep[]
  currentHref: string
}) {
  const i = steps.findIndex(s => norm(s.href) === norm(currentHref))
  const prev = i > 0 ? steps[i - 1] : null
  const next = i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
  if (!prev && !next) return null

  return (
    <nav className="mt-12 border-t border-brand-border pt-6 grid grid-cols-2 gap-4">
      {prev ? (
        <Link
          href={prev.href}
          className="bg-white border border-brand-border rounded-xl p-5 transition-colors hover:border-brand-bronze"
        >
          <span className="flex items-center gap-1.5 text-xs text-brand-hint">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </span>
          <span className="block text-sm font-medium text-brand-text mt-1.5 truncate">
            <span className="tabular-nums text-brand-hint font-normal">{prev.n}</span> {prev.label}
          </span>
        </Link>
      ) : <div />}

      {next ? (
        <Link
          href={next.href}
          className="bg-white border border-brand-border rounded-xl p-5 text-right transition-colors hover:border-brand-bronze col-start-2"
        >
          <span className="flex items-center justify-end gap-1.5 text-xs text-brand-hint">
            Next
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
          <span className="block text-sm font-medium text-brand-text mt-1.5 truncate">
            <span className="tabular-nums text-brand-hint font-normal">{next.n}</span> {next.label}
          </span>
        </Link>
      ) : null}
    </nav>
  )
}
