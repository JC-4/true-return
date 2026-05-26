import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import DealBuilder from './DealBuilder'

export const metadata: Metadata = { title: 'New Deal — TrueReturn' }

export default async function NewDealPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  return <DealBuilder />
}
