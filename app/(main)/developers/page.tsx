import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { DeveloperWithCount } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Developers — TrueReturn',
  description: 'Dubai property developers — track record, portfolio, and active projects.',
}

export const revalidate = 60

async function getDevelopers(): Promise<DeveloperWithCount[]> {
  const { data, error } = await supabase
    .from('developers')
    .select('*, projects(id)')
    .order('name')

  if (error) { console.error('[developers]', error.message); return [] }

  return (data ?? []).map(d => ({
    ...d,
    project_count: Array.isArray(d.projects) ? d.projects.length : 0,
    projects: undefined,
  })) as DeveloperWithCount[]
}

export default async function DevelopersPage() {
  const developers = await getDevelopers()

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-widest text-brand-hint mb-2">Developers</p>
          <h1 className="text-2xl font-semibold text-brand-text">Dubai developers</h1>
          <p className="text-sm text-brand-muted mt-1 leading-relaxed">
            Track record, portfolio size, and active projects — assessed independently.
          </p>
        </div>

        {developers.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-sm text-brand-hint">No developers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {developers.map(dev => (
              <Link
                key={dev.id}
                href={`/developers/${dev.slug}`}
                className="group bg-white border border-brand-border rounded-xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-surface flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {dev.logo_url ? (
                      <img src={dev.logo_url} alt={dev.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-lg font-bold text-brand-muted">{dev.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-brand-text group-hover:text-brand-bronze transition-colors truncate">
                      {dev.name}
                    </h2>
                    {dev.founded_year && (
                      <p className="text-[11px] text-brand-hint">Est. {dev.founded_year}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-surface text-brand-muted">
                    {dev.project_count} {dev.project_count === 1 ? 'project' : 'projects'}
                  </span>
                </div>
                {dev.description && (
                  <p className="text-xs text-brand-muted leading-relaxed line-clamp-3">{dev.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
