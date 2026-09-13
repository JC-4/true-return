import type { Project } from '@/lib/types'

// "Dubai Design District, Dubai" — emirate alone when there is no location.
// Shared by the project page hero, ProjectCard and the shortlist comparison.
export function fmtLocation(p: Pick<Project, 'location' | 'emirate'>): string {
  return p.location ? `${p.location}, ${p.emirate}` : p.emirate
}

/** Mirrors the `projects_status_check` constraint in Supabase — keep the two
 *  in step. These three plus null are the whole set; null is the default and
 *  renders no badge at all.
 *
 *  Shared so the hero and ProjectCard cannot drift: they each used to carry
 *  their own copy, and an unmapped status falls through as its raw slug. */
export const STATUS_LABELS: Record<string, string> = {
  launching_soon:       'Launching soon',
  limited_availability: 'Limited availability',
  off_plan:             'Off plan',
}

export function statusLabel(s: string | null): string | null {
  if (!s) return null
  return STATUS_LABELS[s] ?? s
}

// Min/max unit price for a project, falling back to starting_price for both
// when no unit carries a price. Both null when there is no price data at all.
export function projectPriceRange(p: Pick<Project, 'unit_types' | 'starting_price'>): { min: number | null; max: number | null } {
  const prices = (p.unit_types ?? []).map(u => u.price_from).filter((n): n is number => n != null && n > 0)
  if (prices.length === 0) return { min: p.starting_price, max: p.starting_price }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
