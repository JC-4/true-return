import type { Project } from '@/lib/types'

// "Dubai Design District, Dubai" — emirate alone when there is no location.
// Shared by the project page hero, ProjectCard and the shortlist comparison.
export function fmtLocation(p: Pick<Project, 'location' | 'emirate'>): string {
  return p.location ? `${p.location}, ${p.emirate}` : p.emirate
}

// Min/max unit price for a project, falling back to starting_price for both
// when no unit carries a price. Both null when there is no price data at all.
export function projectPriceRange(p: Pick<Project, 'unit_types' | 'starting_price'>): { min: number | null; max: number | null } {
  const prices = (p.unit_types ?? []).map(u => u.price_from).filter((n): n is number => n != null && n > 0)
  if (prices.length === 0) return { min: p.starting_price, max: p.starting_price }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
