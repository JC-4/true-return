import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import type { Project, ProjectInsight } from '@/lib/types'
import ProjectDetail from './ProjectDetail'

type Props = { params: Promise<{ slug: string }> }

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

  const [session, project] = await Promise.all([
    getServerSession(authOptions),
    getProject(slug),
  ])

  if (!project) notFound()

  // ── Unauthenticated ────────────────────────────────────────────────────────
  if (!session?.user) {
    return <ProjectDetail project={project} />
  }

  // ── Authenticated ──────────────────────────────────────────────────────────
  // Fetch insight data now that we know the user is logged in.
  const insight = await redis.get<ProjectInsight>(`insight:${slug}`)

  const isAdmin = session.user.email === process.env.ADMIN_USERNAME

  // Pass empty object when no Redis insight — truthy value signals the insight
  // layer so the calculator always renders; hasMytake / hasDocs guard text sections.
  return (
    <ProjectDetail
      project={project}
      insight={insight ?? {}}
      isAdmin={isAdmin}
    />
  )
}
