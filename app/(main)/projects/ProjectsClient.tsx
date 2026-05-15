'use client'
import { useState, useMemo } from 'react'
import ProjectCard from '@/components/ProjectCard'
import type { Project } from '@/lib/types'

export default function ProjectsClient({ projects }: { projects: Project[] }) {
  const [developerFilter, setDeveloperFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [communityFilter, setCommunityFilter] = useState('')
  const [handoverFilter, setHandoverFilter] = useState('')
  const [maxPrice, setMaxPrice] = useState<number>(0)

  const developers = useMemo(() => {
    const names = [...new Set(projects.map(p => p.developer?.name).filter(Boolean))] as string[]
    return names.sort()
  }, [projects])

  const communities = useMemo(() => {
    const vals = [...new Set(projects.map(p => p.community).filter(Boolean))] as string[]
    return vals.sort()
  }, [projects])

  const handoverYears = useMemo(() => {
    const years = [...new Set(
      projects.map(p => p.handover_date ? new Date(p.handover_date).getFullYear().toString() : null).filter(Boolean)
    )] as string[]
    return years.sort()
  }, [projects])

  const priceMax = useMemo(() => {
    const max = Math.max(...projects.map(p => p.starting_price ?? 0))
    return max > 0 ? max : 5_000_000
  }, [projects])

  const filtered = useMemo(() => projects.filter(p => {
    if (developerFilter && p.developer?.name !== developerFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    if (communityFilter && p.community !== communityFilter) return false
    if (handoverFilter && p.handover_date) {
      if (new Date(p.handover_date).getFullYear().toString() !== handoverFilter) return false
    }
    if (maxPrice > 0 && p.starting_price && p.starting_price > maxPrice) return false
    return true
  }), [projects, developerFilter, statusFilter, communityFilter, handoverFilter, maxPrice])

  const hasFilters = developerFilter || statusFilter || communityFilter || handoverFilter || maxPrice > 0

  function clearFilters() {
    setDeveloperFilter('')
    setStatusFilter('')
    setCommunityFilter('')
    setHandoverFilter('')
    setMaxPrice(0)
  }

  function fmtPrice(n: number) {
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
    return `AED ${Math.round(n / 1000)}k`
  }

  const selectCls = 'w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-bronze focus:border-brand-bronze'
  const labelCls = 'block text-xs uppercase tracking-widest text-brand-hint mb-1.5'

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-2">Projects</p>
          <h1 className="text-2xl font-medium text-brand-text">Dubai property projects</h1>
          <p className="text-sm text-brand-muted mt-1 leading-relaxed">
            Curated off-plan and ready developments — independently assessed.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Filters sidebar */}
          <aside className="lg:w-52 flex-shrink-0">
            <div className="sticky top-20 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-brand-hint font-medium">Filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-brand-bronze hover:underline">
                    Clear all
                  </button>
                )}
              </div>

              <div>
                <label className={labelCls}>Developer</label>
                <select value={developerFilter} onChange={e => setDeveloperFilter(e.target.value)} className={selectCls}>
                  <option value="">All developers</option>
                  {developers.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
                  <option value="">All statuses</option>
                  <option value="off_plan">Off plan</option>
                  <option value="under_construction">Under construction</option>
                  <option value="ready">Ready</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Community</label>
                <select value={communityFilter} onChange={e => setCommunityFilter(e.target.value)} className={selectCls}>
                  <option value="">All communities</option>
                  {communities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Handover year</label>
                <select value={handoverFilter} onChange={e => setHandoverFilter(e.target.value)} className={selectCls}>
                  <option value="">Any year</option>
                  {handoverYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  Max price{maxPrice > 0 ? ` · ${fmtPrice(maxPrice)}` : ''}
                </label>
                <input
                  type="range"
                  min={0}
                  max={priceMax}
                  step={50000}
                  value={maxPrice || priceMax}
                  onChange={e => setMaxPrice(Number(e.target.value) === priceMax ? 0 : Number(e.target.value))}
                  className="w-full accent-[var(--brand-bronze)]"
                />
                <div className="flex justify-between text-xs text-brand-hint mt-1">
                  <span>AED 0</span>
                  <span>{fmtPrice(priceMax)}</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-sm text-brand-muted mb-3">No projects match these filters.</p>
                <button onClick={clearFilters} className="text-sm text-brand-bronze hover:underline">
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-brand-hint mb-5">
                  {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                  {hasFilters ? ' matching filters' : ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filtered.map(p => <ProjectCard key={p.id} project={p} />)}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
