import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'
import EditProjectClient from './EditProjectClient'

type Props = { params: Promise<{ slug: string }> }

export default async function EditProjectPage({ params }: Props) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(`/login?callbackUrl=/admin/projects/${slug}/edit`)
  if (session.user.email !== process.env.ADMIN_USERNAME) redirect('/')

  const { data: project, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()

  if (error || !project) notFound()

  return <EditProjectClient project={project as Project} />
}
