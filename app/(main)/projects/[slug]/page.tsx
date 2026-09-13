import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import ProjectDetail from './ProjectDetail'

type Props = { params: Promise<{ slug: string }> }

/** Public, indexable and statically rendered. Nothing in this file may read
 *  the session — that opts the route out of the full route cache entirely.
 *  The authenticated layer (insight, My Take, documents, the admin edit link)
 *  resolves client-side in ProjectDetail instead. */
export const revalidate = 60

/** Without this the route has no params to prerender, so Next renders it on
 *  demand and skips the route cache — revalidate alone doesn't get you ISR on
 *  a dynamic segment.
 *
 *  Unlike /developers/[slug] this deliberately leaves `dynamicParams` at its
 *  default. generateStaticParams runs at build time and revalidate does not
 *  re-evaluate it, so a project added between deploys is not in the list;
 *  the default renders it on demand and caches it from then on, where
 *  `dynamicParams = false` would 404 it until the next build. Projects are
 *  added far more often than developers, and a live listing that 404s is a
 *  worse failure than a cold first render. */
export async function generateStaticParams() {
  const { data, error } = await supabase.from('projects').select('slug')
  if (error) { console.error('[project params]', error.message); return [] }
  return (data ?? []).map(({ slug }) => ({ slug }))
}

async function getProject(slug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()
  if (error) { console.error('[project slug]', error.message); return null }
  return data as Project
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return {}
  return {
    title: `${project.name} — Offplan Source`,
    description: project.description?.slice(0, 160) ?? undefined,
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = await getProject(slug)

  if (!project) notFound()

  return <ProjectDetail project={project} />
}
