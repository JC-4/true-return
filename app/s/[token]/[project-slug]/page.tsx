import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fmtLocation } from '@/lib/format'
import { isPreviewParam } from '@/lib/preview'
import { getShortlist, sortedEntries, deriveSteps, isOwnerVisit } from '@/lib/shortlist'
import ReturnAnalysisPanel from '@/components/ReturnAnalysisPanel'
import BrochureTab from '@/components/BrochureTab'
import ProjectGallery from '@/components/ProjectGallery'
import ShortlistViewLogger from '@/components/ShortlistViewLogger'
import ShortlistFooterNav from '@/components/ShortlistFooterNav'

// Fresh data on every request; view logging is client-side so crawler
// fetches are never counted.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Investment shortlist — TrueReturn',
  robots: { index: false, follow: false },
}

export default async function ShortlistProjectPage({ params, searchParams }: {
  params: Promise<{ token: string; 'project-slug': string }>
  searchParams: Promise<{ preview?: string | string[] }>
}) {
  const { token, 'project-slug': projectSlug } = await params
  const preview = isPreviewParam((await searchParams).preview)
  // The sibling /conclusion route resolves first (static beats dynamic), so a
  // project can never be reached through that segment.
  if (projectSlug === 'conclusion') notFound()

  // Look up by token only; the project renders solely as an entry of this
  // shortlist — a valid project slug alone must never resolve.
  const shortlist = await getShortlist(token)
  if (!shortlist) notFound()

  const entry = sortedEntries(shortlist).find(e => e.project.slug === projectSlug)
  if (!entry) notFound()
  const project = entry.project
  const steps = deriveSteps(shortlist, token)
  const ownVisit = await isOwnerVisit(preview)

  return (
    <div className="bg-brand-bg min-h-screen">
      <ShortlistViewLogger token={token} event="expand" entryId={entry.id} disabled={ownVisit} />
      <div className="max-w-6xl mx-auto px-5 sm:px-10 py-10 sm:py-16">

        {/* ── 1. Gallery — the stepper already handles getting back ──────── */}
        <ProjectGallery images={project.images ?? []} />

        {/* ── 2. Project identity ────────────────────────────────────────── */}
        <div className="mt-6">
          {project.developer && (
            <p className="text-xs uppercase tracking-widest text-brand-hint font-medium">{project.developer.name}</p>
          )}
          <h1 className="text-2xl sm:text-3xl font-semibold text-brand-text mt-1">{project.name}</h1>
          <p className="text-sm text-brand-muted mt-1.5">{fmtLocation(project)}</p>
        </div>

        {/* ── 3. The note ────────────────────────────────────────────────── */}
        <div className="mt-8 bg-white border border-brand-border rounded-2xl p-6 sm:p-8" style={{ borderLeftWidth: 3, borderLeftColor: '#A0784A' }}>
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3">Why it&apos;s on your shortlist</p>
          <p className="text-base text-brand-text leading-relaxed max-w-xl">{entry.note}</p>
        </div>

        {/* ── 4. Pros and cons ───────────────────────────────────────────── */}
        {(entry.pros.length > 0 || entry.cons.length > 0) && (
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {entry.pros.length > 0 && (
              /* Gently colour-coded, not alert boxes — this reads as considered judgement */
              <div className="border border-brand-border rounded-2xl p-6" style={{ backgroundColor: '#F2F8F4' }}>
                <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Pros</p>
                <ul className="space-y-2.5">
                  {entry.pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-brand-muted leading-relaxed">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {entry.cons.length > 0 && (
              <div className="border border-brand-border rounded-2xl p-6" style={{ backgroundColor: '#FCF4F3' }}>
                <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-4">Cons</p>
                <ul className="space-y-2.5">
                  {entry.cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-brand-muted leading-relaxed">
                      <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── 5. Return analysis, seeded with this entry's assumptions ───── */}
        <section className="mt-12 border-t border-brand-border pt-10">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium">Return analysis</p>
          <ReturnAnalysisPanel
            project={project}
            showFullAnalysis={true}
            assumptions={entry.assumptions}
            defaultUnitTypeId={entry.unit_type_id}
          />
        </section>

        {/* ── 6. Project materials ───────────────────────────────────────── */}
        <section className="mt-4 border-t border-brand-border">
          <BrochureTab
            slug={project.slug}
            endpoint={`/api/shortlists/${encodeURIComponent(token)}/documents?slug=${encodeURIComponent(project.slug)}`}
          />
        </section>

        {/* ── 7. Sequential movement through the document ────────────────── */}
        <ShortlistFooterNav
          steps={steps}
          currentHref={`/s/${encodeURIComponent(token)}/${project.slug}`}
          preview={preview}
        />

      </div>
    </div>
  )
}
