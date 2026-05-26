import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import type { Project, ProjectInsight } from '@/lib/types'
import ProjectDetail from '../ProjectDetail'

type Props = { params: Promise<{ slug: string }> }

export const revalidate = 60

async function getProject(slug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()
  if (error) { console.error('[insight slug]', error.message); return null }
  return data as Project
}

async function getInsight(slug: string): Promise<ProjectInsight | null> {
  return redis.get<ProjectInsight>(`insight:${slug}`)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  return {
    title: project ? `${project.name} — Insight — TrueReturn` : 'Insight — TrueReturn',
    robots: { index: false, follow: false },
  }
}

export default async function InsightPage({ params }: Props) {
  const { slug } = await params
  const [project, insight] = await Promise.all([getProject(slug), getInsight(slug)])
  if (!project) notFound()
  // Pass empty object when no Redis data — truthy value signals "insight page"
  // so the calculator always renders; hasMytake / hasDocs guard the text sections
  return <ProjectDetail project={project} insight={insight ?? {}} />
}
