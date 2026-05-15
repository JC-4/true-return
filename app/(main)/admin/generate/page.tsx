import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminGenerateClient from './client'

export default async function AdminGeneratePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/generate')
  return <AdminGenerateClient />
}
