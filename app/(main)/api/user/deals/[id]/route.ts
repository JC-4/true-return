import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

type IndexEntry = { id: string; name: string; savedAt: string; updatedAt?: string }
type Params = { params: Promise<{ id: string }> }

async function getUserId() {
  const session = await getServerSession(authOptions)
  return session?.user ? (session.user as { id?: string }).id! : null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const deal = await redis.get(`deal:${userId}:${id}`)
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(deal)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const updatedAt = new Date().toISOString()

  const existing = await redis.get<Record<string, unknown>>(`deal:${userId}:${id}`)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await redis.set(`deal:${userId}:${id}`, { ...existing, ...body, id, updatedAt })

  const index = await redis.get<IndexEntry[]>(`deals:${userId}`) ?? []
  const i = index.findIndex(e => e.id === id)
  if (i >= 0) index[i] = { ...index[i], name: body.name ?? index[i].name, updatedAt }
  await redis.set(`deals:${userId}`, index)

  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await redis.del(`deal:${userId}:${id}`)

  const index = await redis.get<IndexEntry[]>(`deals:${userId}`) ?? []
  await redis.set(`deals:${userId}`, index.filter(e => e.id !== id))

  return NextResponse.json({ ok: true })
}
