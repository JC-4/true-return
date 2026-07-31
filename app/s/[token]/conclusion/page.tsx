import Link from 'next/link'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { fmtLocation } from '@/lib/format'
import { getShortlist, sortedEntries, deriveSteps, hasConclusion } from '@/lib/shortlist'
import ShortlistViewLogger from '@/components/ShortlistViewLogger'
import ShortlistFooterNav from '@/components/ShortlistFooterNav'

// Fresh data on every request; view logging is client-side so crawler
// fetches are never counted.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment shortlist — TrueReturn',
  robots: { index: false, follow: false },
}

const WHATSAPP_NUMBER = '971585940411'

export default async function ShortlistConclusionPage({ params }: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const shortlist = await getShortlist(token)
  // A conclusion page with no words is worse than no conclusion page
  if (!shortlist || !hasConclusion(shortlist)) notFound()

  const entries = sortedEntries(shortlist)
  const steps = deriveSteps(shortlist, token)
  const conclusionHref = `/s/${encodeURIComponent(token)}/conclusion`

  // Absolute URL for the WhatsApp message — derived, never hardcoded
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https')
  const shortlistUrl = `${proto}://${host}/s/${encodeURIComponent(token)}`
  // No names anywhere — the token identifies the shortlist, and anyone the
  // link was forwarded to still arrives with context attached.
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi, I've been through this property shortlist and I'd like to discuss it: ${shortlistUrl}`
  )}`

  return (
    <div className="bg-brand-bg min-h-screen">
      <ShortlistViewLogger token={token} event="conclusion" />
      <div className="max-w-6xl mx-auto px-5 sm:px-10 py-10 sm:py-16">

        {/* ── 1. The conclusion ──────────────────────────────────────────── */}
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">In conclusion</p>
        <div className="bg-white border border-brand-border rounded-2xl p-6 sm:p-10" style={{ borderLeftWidth: 3, borderLeftColor: '#A0784A' }}>
          <p className="text-base sm:text-lg text-brand-text leading-relaxed whitespace-pre-line">
            {shortlist.conclusion}
          </p>
        </div>

        {/* ── 2. Recap of the options ────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="mt-10">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">The options</p>
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              {entries.map(entry => {
                const href = `/s/${encodeURIComponent(token)}/${entry.project.slug}`
                const step = steps.find(s => s.href === href)
                return (
                  <Link
                    key={entry.id}
                    href={href}
                    className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-brand-border last:border-b-0 transition-colors hover:bg-brand-surface"
                  >
                    {step && <span className="text-[11px] tabular-nums text-brand-hint flex-shrink-0">{step.n}</span>}
                    <span className="text-sm font-medium text-brand-text truncate">{entry.project.name}</span>
                    <span className="text-xs text-brand-hint truncate hidden sm:inline">{fmtLocation(entry.project)}</span>
                    <svg className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: '#A0784A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 3. Talk it through ─────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-brand-muted">Questions, or want to talk any of these through?</p>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto text-sm font-medium text-white px-6 py-3.5 rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#25D366' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488" />
            </svg>
            Message me on WhatsApp
          </a>
        </div>

        <ShortlistFooterNav steps={steps} currentHref={conclusionHref} />

      </div>
    </div>
  )
}
