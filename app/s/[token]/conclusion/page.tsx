import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { fmtLocation } from '@/lib/format'
import { getShortlist, sortedEntries, deriveSteps, hasConclusion, isOwnerVisit } from '@/lib/shortlist'
import { isPreviewParam, withPreview } from '@/lib/preview'
import { PREPARER_NAME } from '@/lib/site'
import { whatsappHref } from '@/lib/whatsapp'
import ShortlistViewLogger from '@/components/ShortlistViewLogger'
import ShortlistFooterNav from '@/components/ShortlistFooterNav'

// Fresh data on every request; view logging is client-side so crawler
// fetches are never counted.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment shortlist — TrueReturn',
  robots: { index: false, follow: false },
}

export default async function ShortlistConclusionPage({ params, searchParams }: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const { token } = await params
  const preview = isPreviewParam((await searchParams).preview)

  const shortlist = await getShortlist(token)
  // A conclusion page with no words is worse than no conclusion page
  if (!shortlist || !hasConclusion(shortlist)) notFound()

  const entries = sortedEntries(shortlist)
  const steps = deriveSteps(shortlist, token)
  const conclusionHref = `/s/${encodeURIComponent(token)}/conclusion`
  const ownVisit = await isOwnerVisit(preview)

  // Blank lines separate paragraphs; the first runs as a lede. hasConclusion
  // guarantees at least one non-empty paragraph.
  const conclusionParagraphs = (shortlist.conclusion ?? '')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)

  const preparedOn = new Date(shortlist.created_at)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Absolute URL for the WhatsApp message — derived, never hardcoded
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? 'http' : 'https')
  const shortlistUrl = `${proto}://${host}/s/${encodeURIComponent(token)}`
  // No names anywhere — the token identifies the shortlist, and anyone the
  // link was forwarded to still arrives with context attached.
  const waHref = whatsappHref(
    `Hi, I've been through this property shortlist and I'd like to discuss it: ${shortlistUrl}`
  )

  return (
    <div className="bg-brand-bg min-h-screen">
      <ShortlistViewLogger token={token} event="conclusion" disabled={ownVisit} />
      {/* One measure for the whole page — prose, recap, sign-off and nav all
          align to the same column. Only the stepper runs full width. */}
      <div className="max-w-[44rem] mx-auto px-5 sm:px-10 py-10 sm:py-16">

        {/* ── 1. The conclusion ──────────────────────────────────────────── */}
        {/* No card or eyebrow: the whole page is my commentary, so there is
            nothing to mark it off from. */}
        <div className="mt-4 sm:mt-8 space-y-5">
          {conclusionParagraphs.map((para, i) => (
            <p key={i} className="text-lg text-brand-text leading-relaxed whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>

        {/* ── 2. Recap of the options ────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="mt-10">
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">The options</p>
            <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
              {entries.map(entry => {
                const href = `/s/${encodeURIComponent(token)}/${entry.project.slug}`
                const thumb = entry.project.images?.[0]
                return (
                  <Link
                    key={entry.id}
                    href={withPreview(href, preview)}
                    className="flex items-center gap-3.5 px-5 sm:px-6 py-3.5 border-b border-brand-border last:border-b-0 transition-colors hover:bg-brand-surface"
                  >
                    {/* Fixed box either way, so rows without an image stay
                        aligned with the rest */}
                    {thumb ? (
                      <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={thumb} alt="" fill sizes="44px" className="object-cover" style={{ objectPosition: 'center 40%' }} />
                      </div>
                    ) : (
                      <div className="w-11 h-11 flex-shrink-0" />
                    )}

                    {/* No step numbers here — a list starting at 2 reads as
                        though something is missing. The stepper keeps them. */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-brand-text truncate">{entry.project.name}</p>
                      <p className="text-xs text-brand-hint truncate mt-0.5">{fmtLocation(entry.project)}</p>
                    </div>

                    {entry.recommended === true && (
                      <span
                        className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-white px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#A0784A' }}
                      >
                        Recommended
                      </span>
                    )}

                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#A0784A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 3. Talk it through ─────────────────────────────────────────── */}
        {waHref && (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-brand-muted">Questions, or want to talk any of these through?</p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2.5 w-full sm:w-auto text-sm font-medium text-white px-6 py-3.5 rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#A0784A' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488" />
            </svg>
            Message me on WhatsApp
          </a>
        </div>
        )}

        {/* ── 4. Sign-off — closes like a letter, last thing before nav ──── */}
        {/* The page's only rule: everything above is content, this is the
            signature. */}
        <div className="mt-12 border-t border-brand-border pt-6">
          <p className="text-sm text-brand-muted">
            Prepared for {shortlist.client_name} · {preparedOn}
          </p>
          <p className="text-sm font-medium text-brand-text mt-1">{PREPARER_NAME}</p>
        </div>

        <ShortlistFooterNav steps={steps} currentHref={conclusionHref} preview={preview} />

      </div>
    </div>
  )
}
