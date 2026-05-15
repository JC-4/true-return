import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import ProjectsClient from './ProjectsClient'
import type { Project } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Projects — TrueReturn',
  description: 'Browse Dubai off-plan and ready property projects.',
}

export const revalidate = 60

async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .order('name')

  if (error) { console.error('[projects]', error.message); return [] }
  return (data ?? []) as Project[]
}

export default async function ProjectsPage() {
  const projects = await getProjects()
  return <ProjectsClient projects={projects} />
}
