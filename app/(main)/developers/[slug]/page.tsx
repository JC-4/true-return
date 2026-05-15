import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProjectCard from '@/components/ProjectCard'
import type { Developer, Project } from '@/lib/types'

type Props = { params: Promise<{ slug: string }> }

export const revalidate = 60

type DeveloperWithProjects = Developer & { projects: Project[] }

async function getDeveloper(slug: string): Promise<DeveloperWithProjects | null> {
  const { data: developer, error: devErr } = await supabase
    .from('developers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (devErr) { console.error('[developer slug]', devErr.message); return null }

  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .eq('developer_id', developer.id)
    .order('name')

  if (projErr) { console.error('[developer projects]', projErr.message); return null }

  return { ...developer, projects: (projects ?? []) as Project[] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const dev = await getDeveloper(slug)
  if (!dev) return {}
  return {
    title: `${dev.name} — TrueReturn`,
    description: dev.description?.slice(0, 160) ?? undefined,
  }
}

export default async function DeveloperPage({ params }: Props) {
  const { slug } = await params
  const dev = await getDeveloper(slug)
  if (!dev) notFound()

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

        <Link
          href="/developers"
          className="inline-flex items-center gap-1.5 text-xs text-brand-hint hover:text-brand-muted mb-8 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All developers
        </Link>

        <div className="bg-white border border-brand-border rounded-xl p-8 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-xl bg-brand-surface flex-shrink-0 flex items-center justify-center overflow-hidden">
              {dev.logo_url ? (
                <img src={dev.logo_url} alt={dev.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-2xl font-bold text-brand-muted">{dev.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-1">Developer</p>
              <h1 className="text-xl font-semibold text-brand-text mb-3">{dev.name}</h1>
              {dev.description && (
                <p className="text-sm text-brand-muted leading-relaxed mb-5 max-w-2xl">{dev.description}</p>
              )}
              <div className="flex flex-wrap gap-6">
                {dev.founded_year && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-0.5">Founded</p>
                    <p className="text-sm font-semibold text-brand-text">{dev.founded_year}</p>
                  </div>
                )}
                {dev.portfolio_value && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-0.5">Portfolio</p>
                    <p className="text-sm font-semibold text-brand-text">{dev.portfolio_value}</p>
                  </div>
                )}
                {dev.delivered_units != null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-0.5">Delivered units</p>
                    <p className="text-sm font-semibold text-brand-text">{dev.delivered_units.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-5">
            Projects by {dev.name}
          </p>
          {dev.projects.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-brand-hint">No projects listed yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {dev.projects.map(p => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
