import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import type { ProjectInsight } from '@/lib/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const body = await req.json() as { params: Record<string, unknown> }

  // Read the existing insight record and merge in the new default params
  const existing = await redis.get<ProjectInsight>(`insight:${slug}`) ?? {}
  await redis.set(`insight:${slug}`, { ...existing, defaultParams: body.params })

  return NextResponse.json({ ok: true })
}
