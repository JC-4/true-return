import Link from 'next/link'
import type { Project } from '@/lib/types'

function fmtPrice(n: number | null) {
  if (!n) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${Math.round(n / 1000)}k`
}

function fmtHandover(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `Q${q} ${d.getFullYear()}`
}

function statusLabel(s: string | null) {
  if (!s) return null
  if (s === 'off_plan') return 'Off plan'
  if (s === 'under_construction') return 'Under construction'
  if (s === 'ready') return 'Ready'
  return s
}

export default function ProjectCard({ project }: { project: Project }) {
  const hero = project.images?.[0] ?? null

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block bg-white border border-brand-border rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
    >
      {/* Image */}
      <div className="relative aspect-video bg-brand-surface overflow-hidden">
        {hero ? (
          <img
            src={hero}
            alt={project.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-hint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
        {project.status && (
          <span className="absolute top-3 left-3 bg-brand-bronze text-white text-xs px-2 py-0.5 rounded-full">
            {statusLabel(project.status)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-xs text-brand-hint uppercase tracking-wide">
          {project.developer?.name ?? '—'}
        </p>
        <h3 className="text-base font-medium text-brand-text mt-0.5 group-hover:text-brand-bronze transition-colors">
          {project.name}
        </h3>
        {project.location && (
          <p className="text-xs text-brand-muted mt-1">
            {project.location}{project.community ? ` · ${project.community}` : ''}
          </p>
        )}
        <div className="flex items-end justify-between mt-3 pt-3 border-t border-brand-border">
          <p className="text-sm font-medium text-brand-bronze">{fmtPrice(project.starting_price)}</p>
          <p className="text-xs text-brand-hint">{fmtHandover(project.handover_date)}</p>
        </div>
      </div>
    </Link>
  )
}
