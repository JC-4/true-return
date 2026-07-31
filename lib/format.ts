import type { Project } from '@/lib/types'

// "Dubai Design District, Dubai" — emirate alone when there is no location.
// Shared by the project page hero, ProjectCard and the shortlist comparison.
export function fmtLocation(p: Pick<Project, 'location' | 'emirate'>): string {
  return p.location ? `${p.location}, ${p.emirate}` : p.emirate
}
