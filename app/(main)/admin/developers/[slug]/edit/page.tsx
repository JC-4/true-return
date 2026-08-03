import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { Developer, DeliveredProject } from '@/lib/types'
import EditDeveloperClient from './EditDeveloperClient'

type Props = { params: Promise<{ slug: string }> }

export default async function EditDeveloperPage({ params }: Props) {
  const { slug } = await params

  const session = await getServerSession(authOptions)
  if (!session?.user) redirect(`/login?callbackUrl=/admin/developers/${slug}/edit`)
  if (session.user.email !== process.env.ADMIN_USERNAME) redirect('/')

  const { data: developer, error } = await supabase
    .from('developers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !developer) notFound()

  const { data: delivered } = await supabase
    .from('developer_delivered_projects')
    .select('*')
    .eq('developer_id', developer.id)
    .order('sort_order')

  return (
    <EditDeveloperClient
      developer={developer as Developer}
      initialDelivered={(delivered ?? []) as DeliveredProject[]}
    />
  )
}
