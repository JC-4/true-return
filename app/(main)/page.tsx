import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import ProjectCard from '@/components/ProjectCard'

export const revalidate = 60

async function getFeaturedProjects(): Promise<Project[]> {
  const { data } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .order('created_at', { ascending: false })
    .limit(3)
  return (data ?? []) as Project[]
}

export default async function Home() {
  const featured = await getFeaturedProjects()

  return (
    <div className="theme-os">

      {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
      <section className="bg-brand-inverse-deep">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-36">
          <p className="text-sm font-medium mb-5 text-brand-on-inverse-hint">
            UAE off-plan property
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight mb-6 text-brand-on-inverse max-w-[720px]">
            Independent analysis on the UAE&apos;s off-plan market.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-10 text-brand-on-inverse-muted max-w-[560px]">
            Real numbers on every project. IRR, yield, financing — before you commit.
          </p>
          <Link
            href="/projects"
            className="btn-on-ink inline-flex items-center font-medium px-6 py-3 rounded-lg text-sm"
          >
            Browse projects →
          </Link>
        </div>
      </section>

      {/* ── Section 2: How it works ────────────────────────────────────────── */}
      <section className="bg-brand-surface">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <h2 className="text-sm font-medium mb-12 text-brand-muted">
            How it works
          </h2>
          {/* A genuine sequence, so the steps stay numbered. */}
          <ol className="grid sm:grid-cols-3 gap-8">
            {[
              {
                n: '1',
                title: 'Browse projects',
                body: 'Explore independently analysed off-plan developments across the UAE.',
              },
              {
                n: '2',
                title: 'Run the numbers',
                body: 'Adjust assumptions and see IRR, yield, and exit scenarios in real time.',
              },
              {
                n: '3',
                title: 'Get independent advice',
                body: 'Speak to an agent who works for you, not the developer.',
              },
            ].map(({ n, title, body }) => (
              <li key={n} className="border-t border-brand-border pt-6">
                <p className="text-2xl font-medium mb-3 text-brand-hint">{n}</p>
                <h3 className="text-base font-semibold mb-2 text-brand-text">{title}</h3>
                <p className="text-sm leading-relaxed text-brand-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Section 3: Featured projects ───────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-brand-bg border-t border-brand-border">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-xl font-medium text-brand-text">
                  Latest developments
                </h2>
                <p className="text-sm text-brand-muted mt-1">
                  The three most recently analysed projects.
                </p>
              </div>
              <Link href="/projects" className="text-sm font-medium text-brand-text underline underline-offset-4 decoration-brand-border hover:decoration-brand-text transition-colors">
                View all →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {featured.map(p => <ProjectCard key={p.id} project={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Section 4: What you get ────────────────────────────────────────── */}
      <section className="bg-brand-inverse-deep border-t border-brand-inverse-line">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-4 leading-snug text-brand-on-inverse">
              The full picture, not the brochure.
            </h2>
            <p className="text-sm leading-relaxed mb-8 text-brand-on-inverse-muted max-w-[480px]">
              Most buyers only see what the developer shows them. Registered clients see everything.
            </p>
            <Link
              href="/contact"
              className="btn-on-ink inline-flex items-center font-medium px-6 py-3 rounded-lg text-sm"
            >
              Get independent advice →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
