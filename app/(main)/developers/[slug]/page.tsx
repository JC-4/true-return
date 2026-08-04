import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProjectCard from '@/components/ProjectCard'
import AdminEditLink from '@/components/AdminEditLink'
import LeadGenForm from '@/components/LeadGenForm'
import type { Developer, DeliveredProject, GlanceRow, Project } from '@/lib/types'

type Props = { params: Promise<{ slug: string }> }

/** Statically rendered and revalidated — the admin edit link resolves
 *  client-side precisely so nothing here has to read the session. */
export const revalidate = 60

/** Without this the route has no params to prerender, so Next renders it on
 *  demand and skips the route cache entirely — revalidate alone doesn't get
 *  you ISR on a dynamic segment. Slugs added later still resolve on demand. */
export async function generateStaticParams() {
  const { data, error } = await supabase.from('developers').select('slug')
  if (error) { console.error('[developer params]', error.message); return [] }
  return (data ?? []).map(({ slug }) => ({ slug }))
}

/** Delivered projects shown as cards. The rest are named in a plain text line. */
const DELIVERED_CARD_LIMIT = 4

type DeveloperAnalysis = Developer & {
  projects: Project[]
  delivered: DeliveredProject[]
}

/** "Plus No.9 and Studio One." — Oxford-free list, matching how it reads aloud. */
function fmtOverflowNames(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** at_a_glance is hand-entered jsonb, so tolerate malformed rows rather than throwing. */
function glanceRows(raw: unknown): GlanceRow[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(r => {
    if (!r || typeof r !== 'object') return []
    const { label, value } = r as Record<string, unknown>
    if (typeof label !== 'string' || !label.trim()) return []
    if (value == null || String(value).trim() === '') return []
    return [{ label: label.trim(), value: String(value).trim() }]
  })
}

/** The sections carry no fixed subject, so the alt text leans on whatever the
 *  heading says. Without a heading there is nothing to describe beyond who it
 *  belongs to. */
function imageAlt(name: string, heading: string | null): string {
  return heading ? `${name} — ${heading}` : name
}

function fmtReviewed(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

async function getDeveloper(slug: string): Promise<DeveloperAnalysis | null> {
  const { data: developer, error: devErr } = await supabase
    .from('developers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (devErr) { console.error('[developer slug]', devErr.message); return null }

  const [{ data: projects, error: projErr }, { data: delivered, error: delErr }] = await Promise.all([
    supabase
      .from('projects')
      .select('*, developer:developers(*)')
      .eq('developer_id', developer.id)
      .order('name'),
    supabase
      .from('developer_delivered_projects')
      .select('*')
      .eq('developer_id', developer.id)
      .order('sort_order'),
  ])

  if (projErr) { console.error('[developer projects]', projErr.message); return null }
  // Delivered records are supplementary — a failure here shouldn't 404 the page.
  if (delErr) console.error('[developer delivered]', delErr.message)

  return {
    ...developer,
    projects: (projects ?? []) as Project[],
    delivered: (delivered ?? []) as DeliveredProject[],
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const dev = await getDeveloper(slug)
  if (!dev) return {}
  const summary = dev.description ?? dev.section_1_body
  return {
    title: `${dev.name} — TrueReturn`,
    description: summary?.slice(0, 160) ?? undefined,
  }
}

export default async function DeveloperPage({ params }: Props) {
  const { slug } = await params
  const dev = await getDeveloper(slug)
  if (!dev) notFound()

  const glance = glanceRows(dev.at_a_glance)
  const reviewed = fmtReviewed(dev.reviewed_at)

  const deliveredCards = dev.delivered.slice(0, DELIVERED_CARD_LIMIT)
  const overflowNames = dev.delivered.slice(DELIVERED_CARD_LIMIT).map(d => d.name)

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-xs text-brand-hint hover:text-brand-muted mb-8 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All developers
        </Link>

        {/* 1. Header — identity left, at a glance right. Single column on
               mobile with the left column first, by DOM order. */}
        <div className="bg-white border border-brand-border rounded-xl p-6 sm:p-8 mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-4 mb-5">
                {/* White behind a real logo so a transparent PNG blends into the
                    card instead of reading as a grey square. The initial fallback
                    keeps the tint and stays square — a 130px-wide box holding one
                    letter reads as an empty bar. */}
                <div
                  className={`rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden ${
                    dev.logo_url ? 'w-[130px] h-16 bg-white' : 'w-20 h-20 bg-brand-surface'
                  }`}
                >
                  {dev.logo_url ? (
                    <img src={dev.logo_url} alt={dev.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-brand-muted">{dev.name.charAt(0)}</span>
                  )}
                </div>
                <AdminEditLink resource="developers" slug={dev.slug} label="Edit developer" />
              </div>

              <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-1">Developer analysis</p>
              <h1 className="text-xl font-semibold text-brand-text">{dev.name}</h1>
              {reviewed && (
                <p className="text-xs text-brand-hint mt-2">
                  Reviewed <time dateTime={dev.reviewed_at!}>{reviewed}</time>
                </p>
              )}
              {dev.description && (
                <p className="text-sm text-brand-muted leading-relaxed mt-5">{dev.description}</p>
              )}
            </div>

            {glance.length > 0 && (
              <div className="bg-brand-surface border border-brand-border rounded-xl p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-3">At a glance</p>
                <table className="w-full text-sm">
                  <tbody>
                    {glance.map((row, i) => (
                      <tr
                        key={`${row.label}-${i}`}
                        className={i > 0 ? 'border-t border-brand-border' : undefined}
                      >
                        <th
                          scope="row"
                          className="py-2.5 pr-6 text-left align-top font-normal text-brand-muted w-2/5"
                        >
                          {row.label}
                        </th>
                        <td className="py-2.5 align-top font-medium text-brand-text">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>

        {/* 3. Under construction — read live from projects */}
        <section className="mb-12">
          <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-5">Under construction</p>
          {dev.projects.length === 0 ? (
            <p className="text-sm text-brand-hint py-8">No projects listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {dev.projects.map(p => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        {/* 4. Delivered — not links, these buildings have no project page */}
        {dev.delivered.length > 0 && (
          <section className="mb-12">
            <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-5">Delivered</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {deliveredCards.map(d => (
                <div
                  key={d.id}
                  className="bg-white border border-brand-border rounded-xl overflow-hidden"
                >
                  <div className="relative aspect-[4/3] bg-brand-surface overflow-hidden">
                    {d.image_url ? (
                      <img src={d.image_url} alt={d.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-medium text-brand-text truncate">{d.name}</h3>
                    {d.location && (
                      <p className="text-xs text-brand-muted mt-0.5 truncate">{d.location}</p>
                    )}
                    {d.year != null && (
                      <p className="text-xs text-brand-hint mt-1">{d.year}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {overflowNames.length > 0 && (
              <p className="mt-4 text-sm text-brand-muted">
                Plus {fmtOverflowNames(overflowNames)}.
              </p>
            )}
          </section>
        )}

        {/* 5. Section 1 — prose left, image right. The heading is whatever the
               editor set; without one the section renders with no eyebrow. */}
        {dev.section_1_body && (
          <section className="mb-12">
            {dev.section_1_heading && (
              <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-4">
                {dev.section_1_heading}
              </p>
            )}
            {dev.section_1_image_url ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-line">
                  {dev.section_1_body}
                </p>
                <img
                  src={dev.section_1_image_url}
                  alt={imageAlt(dev.name, dev.section_1_heading)}
                  className="w-full rounded-xl border border-brand-border bg-white"
                />
              </div>
            ) : (
              <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-line">
                {dev.section_1_body}
              </p>
            )}
          </section>
        )}

        {/* 6. Section 2 — image left, prose right. Reversed against section 1
               above so the two rows don't read as a pattern. The image is first
               in the DOM, so it also leads on mobile. */}
        {dev.section_2_body && (
          <section className="mb-12">
            {dev.section_2_heading && (
              <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-4">
                {dev.section_2_heading}
              </p>
            )}
            {dev.section_2_image_url ? (
              <figure className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center m-0">
                <img
                  src={dev.section_2_image_url}
                  alt={imageAlt(dev.name, dev.section_2_heading)}
                  className="w-full rounded-xl border border-brand-border bg-white"
                />
                <figcaption className="text-sm text-brand-muted leading-relaxed whitespace-pre-line">
                  {dev.section_2_body}
                </figcaption>
              </figure>
            ) : (
              <p className="text-sm text-brand-muted leading-relaxed whitespace-pre-line">
                {dev.section_2_body}
              </p>
            )}
          </section>
        )}

        {/* 7. Lead gen — always rendered. LeadGenForm is a client component
               taking public strings only, so it doesn't affect static rendering. */}
        <section id="lead-gen-form" className="bg-white border border-brand-border rounded-xl">
          <div className="px-6 sm:px-10 py-16 sm:py-20">
            <div style={{ maxWidth: 600, margin: '0 auto' }}>
              <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-3 text-center">
                Independent advice
              </p>
              <h2 className="text-2xl font-semibold text-brand-text mb-2 text-center">
                Thinking about a {dev.name} project?
              </h2>
              <p className="text-sm text-brand-muted mb-8 text-center">
                I will tell you which of their buildings are worth the money and which are not. No cost to you.
              </p>
              <LeadGenForm
                projectName={dev.name}
                isProjectPage={false}
                source="Developer page"
              />
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
