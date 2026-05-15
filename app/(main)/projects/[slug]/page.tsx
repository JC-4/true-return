import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import ProjectDetail from './ProjectDetail'

type Props = { params: Promise<{ slug: string }> }

export const revalidate = 60

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
    title: `${project.name} — TrueReturn`,
    description: project.description?.slice(0, 160) ?? undefined,
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) notFound()
  return <ProjectDetail project={project} />
}
