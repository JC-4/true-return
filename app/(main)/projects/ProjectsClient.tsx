'use client'
import { useState, useMemo } from 'react'
import ProjectCard from '@/components/ProjectCard'
import type { Project } from '@/lib/types'
import { projectPriceRange } from '@/lib/format'

// Fixed ladder so the control doesn't shift as the catalogue grows
const PRICE_LADDER = [
  500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
  5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000,
]

export default function ProjectsClient({ projects }: { projects: Project[] }) {
  const [developerFilter, setDeveloperFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [emirateFilter, setEmirateFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [handoverFilter, setHandoverFilter] = useState('')
  const [minPrice, setMinPrice] = useState(0) // 0 = no bound
  const [maxPrice, setMaxPrice] = useState(0)

  function handleMinPriceChange(v: number) {
    setMinPrice(v)
    // Max options are strictly greater than min, so a max at or below the new
    // min is no longer selectable — clear it
    if (v > 0 && maxPrice > 0 && maxPrice <= v) setMaxPrice(0)
  }

  const developers = useMemo(() => {
    const names = [...new Set(projects.map(p => p.developer?.name).filter(Boolean))] as string[]
    return names.sort()
  }, [projects])

  // Only emirates actually present in the data, in the edit form's order
  const emirates = useMemo(() => {
    const present = new Set(projects.map(p => p.emirate).filter(Boolean))
    return ['Dubai', 'Abu Dhabi', 'Ras Al Khaimah', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Fujairah']
      .filter(e => present.has(e))
  }, [projects])

  // Locations narrow to the selected emirate when one is chosen
  const locations = useMemo(() => {
    const pool = emirateFilter ? projects.filter(p => p.emirate === emirateFilter) : projects
    const vals = [...new Set(pool.map(p => p.location).filter(Boolean))] as string[]
    return vals.sort()
  }, [projects, emirateFilter])

  function handleEmirateChange(v: string) {
    setEmirateFilter(v)
    // Keep the location filter unless it no longer exists under the new emirate
    if (locationFilter && !projects.some(p => p.location === locationFilter && (!v || p.emirate === v))) {
      setLocationFilter('')
    }
  }

  const handoverYears = useMemo(() => {
    const years = [...new Set(
      projects.map(p => p.handover_date ? new Date(p.handover_date).getFullYear().toString() : null).filter(Boolean)
    )] as string[]
    return years.sort()
  }, [projects])

  const filtered = useMemo(() => projects.filter(p => {
    if (developerFilter && p.developer?.name !== developerFilter) return false
    if (statusFilter && p.status !== statusFilter) return false
    if (emirateFilter && p.emirate !== emirateFilter) return false
    if (locationFilter && p.location !== locationFilter) return false
    if (handoverFilter && p.handover_date) {
      if (new Date(p.handover_date).getFullYear().toString() !== handoverFilter) return false
    }
    // Match on overlap with the project's unit price range, not starting
    // price: a project shows if any of its units could fall in the range.
    // Projects with no price data at all are never filtered out.
    if (minPrice > 0 || maxPrice > 0) {
      const { min, max } = projectPriceRange(p)
      if (min != null && max != null) {
        if (minPrice > 0 && max < minPrice) return false
        if (maxPrice > 0 && min > maxPrice) return false
      }
    }
    return true
  }), [projects, developerFilter, statusFilter, emirateFilter, locationFilter, handoverFilter, minPrice, maxPrice])

  const hasFilters = developerFilter || statusFilter || emirateFilter || locationFilter || handoverFilter || minPrice > 0 || maxPrice > 0

  function clearFilters() {
    setDeveloperFilter('')
    setStatusFilter('')
    setEmirateFilter('')
    setLocationFilter('')
    setHandoverFilter('')
    setMinPrice(0)
    setMaxPrice(0)
  }

  function fmtPrice(n: number) {
    if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
    return `AED ${Math.round(n / 1000)}k`
  }

  const selectCls = 'w-full px-3 py-2 text-sm rounded-lg border border-brand-border bg-brand-raise text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-text focus:border-brand-text'
  const labelCls = "block text-xs font-medium text-brand-muted mb-1.5"

  return (
    <div className="theme-os min-h-screen bg-brand-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-2xl font-medium text-brand-text">UAE property projects</h1>
          <p className="text-sm text-brand-muted mt-1 leading-relaxed">
            Curated off-plan and ready developments — independently assessed.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
          {/* Filters sidebar */}
          <aside className="lg:w-52 flex-shrink-0">
            <div className="sticky top-20 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-brand-text">Filters</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-brand-muted underline underline-offset-4 hover:text-brand-text transition-colors">
                    Clear all
                  </button>
                )}
              </div>

              <div>
                <label className={labelCls}>Emirate</label>
                <select value={emirateFilter} onChange={e => handleEmirateChange(e.target.value)} className={selectCls}>
                  <option value="">All emirates</option>
                  {emirates.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
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
                  <option value="launching_soon">Launching soon</option>
                  <option value="limited_availability">Limited availability</option>
                  <option value="sold_out">Sold out</option>
                  <option value="under_construction">Under construction</option>
                  <option value="ready">Ready</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Location</label>
                <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)} className={selectCls}>
                  <option value="">All locations</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
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
                <label className={labelCls}>Min price</label>
                <select value={minPrice} onChange={e => handleMinPriceChange(Number(e.target.value))} className={selectCls}>
                  <option value={0}>No min</option>
                  {PRICE_LADDER.map(v => <option key={v} value={v}>{fmtPrice(v)}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Max price</label>
                <select value={maxPrice} onChange={e => setMaxPrice(Number(e.target.value))} className={selectCls}>
                  <option value={0}>No max</option>
                  {PRICE_LADDER.filter(v => v > minPrice).map(v => <option key={v} value={v}>{fmtPrice(v)}</option>)}
                </select>
              </div>
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-sm text-brand-muted mb-3">No projects match these filters.</p>
                <button onClick={clearFilters} className="text-sm text-brand-muted underline underline-offset-4 hover:text-brand-text transition-colors">
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
