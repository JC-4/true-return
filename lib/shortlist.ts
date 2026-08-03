import { cache } from 'react'
import { getServerSession } from 'next-auth'
import { createServiceClient } from '@/lib/supabase'
import { authOptions } from '@/lib/auth'
import type { Project, UnitType, Shortlist, ShortlistEntry } from '@/lib/types'

export type LoadedEntry = ShortlistEntry & { project: Project | null; unit_type: UnitType | null }
export type LoadedShortlist = Shortlist & { entries: LoadedEntry[] }
export type EntryWithProject = LoadedEntry & { project: Project }

/** One numbered step in the document: comparison, each project, then the conclusion. */
export type ShortlistStep = { n: number; label: string; href: string }

// Cached per request so the layout (stepper) and the page (content) share a
// single query. Token is the only lookup key — never any other URL segment.
export const getShortlist = cache(async (token: string): Promise<LoadedShortlist | null> => {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('shortlists')
    .select('*, entries:shortlist_entries(*, project:projects(*, developer:developers(*), unit_types(*)), unit_type:unit_types(*))')
    .eq('token', token)
    .single()
  if (error || !data) return null
  return data as LoadedShortlist
})

// My own visits shouldn't show up as client activity: a signed-in admin
// session covers normal browsing, ?preview=1 covers a private window where
// there is no session to detect. Decided server side and handed to the logger.
export async function isOwnerVisit(preview: boolean): Promise<boolean> {
  if (preview) return true
  const session = await getServerSession(authOptions)
  return !!session?.user
}

/** Entries in sort_order, dropping any whose project has since been deleted. */
export function sortedEntries(shortlist: LoadedShortlist): EntryWithProject[] {
  return [...(shortlist.entries ?? [])]
    .filter((e): e is EntryWithProject => !!e.project)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function hasConclusion(shortlist: LoadedShortlist): boolean {
  return !!shortlist.conclusion?.trim()
}

// Single source of truth for the document's shape, so the header stepper and
// the footer prev/next can never disagree.
export function deriveSteps(shortlist: LoadedShortlist, token: string): ShortlistStep[] {
  const base = `/s/${encodeURIComponent(token)}`
  const steps: Omit<ShortlistStep, 'n'>[] = [
    { label: 'Comparison', href: base },
    ...sortedEntries(shortlist).map(e => ({ label: e.project.name, href: `${base}/${e.project.slug}` })),
  ]
  // Omitted entirely when there is no closing note to read
  if (hasConclusion(shortlist)) steps.push({ label: 'Conclusion', href: `${base}/conclusion` })
  return steps.map((s, i) => ({ ...s, n: i + 1 }))
}
