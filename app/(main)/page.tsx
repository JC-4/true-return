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
    <div>

      {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#0E0E0C' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-28 sm:py-36">
          <p className="text-xs uppercase tracking-widest font-medium mb-5"
            style={{ color: 'var(--color-text-secondary)' }}>
            Dubai off-plan property
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight mb-6 text-white"
            style={{ maxWidth: 720 }}>
            Independent analysis on Dubai&apos;s off-plan market.
          </h1>
          <p className="text-base sm:text-lg leading-relaxed mb-10"
            style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 560 }}>
            Real numbers on every project. IRR, yield, financing - before you commit.
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center bg-brand-bronze hover:bg-brand-bronze/90 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Browse projects →
          </Link>
        </div>
      </section>

      {/* ── Section 2: How it works ────────────────────────────────────────── */}
      <section style={{ backgroundColor: 'var(--color-background-secondary)' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <p className="text-xs uppercase tracking-widest font-medium mb-12"
            style={{ color: 'var(--color-text-secondary)' }}>
            How it works
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                n: '1',
                title: 'Browse projects',
                body: 'Explore independently analysed off-plan developments across Dubai.',
              },
              {
                n: '2',
                title: 'Run the numbers',
                body: 'Adjust assumptions and see IRR, yield, and exit scenarios in real time.',
              },
              {
                n: '3',
                title: 'Get independent advice',
                body: "Speak to an agent who works for you, not the developer.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="border-t pt-6" style={{ borderColor: 'var(--color-border-primary)' }}>
                <p className="text-2xl font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>{n}</p>
                <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 3: Featured projects ───────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-white" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs uppercase tracking-widest font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  Featured projects
                </p>
                <h2 className="text-xl font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Latest developments
                </h2>
              </div>
              <Link href="/projects" className="text-sm font-medium text-brand-bronze hover:text-brand-bronze/80 transition-colors">
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
      <section style={{ backgroundColor: '#0E0E0C', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-4 leading-snug text-white">
              The full picture, not the brochure.
            </h2>
            <p className="text-sm leading-relaxed mb-8"
              style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 480 }}>
              Most buyers only see what the developer shows them. Registered clients see everything.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center bg-brand-bronze hover:bg-brand-bronze/90 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
            >
              Get independent advice →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
