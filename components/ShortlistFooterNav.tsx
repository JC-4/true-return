import Link from 'next/link'
import { withPreview } from '@/lib/preview'
import type { ShortlistStep } from '@/lib/shortlist'

const norm = (s: string) => decodeURIComponent(s).replace(/\/+$/, '')

// Sequential movement through the document — the primary motion. The header
// stepper handles jumping around. Same component on every page so previous/
// next behave identically wherever the reader is.
export default function ShortlistFooterNav({ steps, currentHref, preview = false }: {
  steps: ShortlistStep[]
  currentHref: string
  preview?: boolean
}) {
  const i = steps.findIndex(s => norm(s.href) === norm(currentHref))
  const prev = i > 0 ? steps[i - 1] : null
  const next = i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
  if (!prev && !next) return null

  // Plain links, no card or rule — this is navigation, not content
  return (
    <nav className="mt-10 flex items-center gap-6">
      {prev ? (
        <Link
          href={withPreview(prev.href, preview)}
          className="inline-flex items-center gap-1.5 min-w-0 text-sm text-brand-muted hover:text-brand-bronze transition-colors"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="truncate">
            <span className="tabular-nums text-brand-hint">{prev.n}</span> {prev.label}
          </span>
        </Link>
      ) : <span />}

      {next ? (
        <Link
          href={withPreview(next.href, preview)}
          className="inline-flex items-center gap-1.5 min-w-0 ml-auto text-sm text-brand-muted hover:text-brand-bronze transition-colors"
        >
          <span className="truncate">
            <span className="tabular-nums text-brand-hint">{next.n}</span> {next.label}
          </span>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ) : null}
    </nav>
  )
}
