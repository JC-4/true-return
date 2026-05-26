import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import type { ProjectInsight } from '@/lib/types'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params
  const data = await redis.get<ProjectInsight>(`insight:${slug}`)
  return NextResponse.json(data ?? {})
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const body = await req.json() as ProjectInsight
  await redis.set(`insight:${slug}`, body)
  return NextResponse.json({ ok: true })
}
