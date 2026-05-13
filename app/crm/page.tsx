import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CRMPage from './CRMContent'

export default async function CRMServerPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return <CRMPage />
}
