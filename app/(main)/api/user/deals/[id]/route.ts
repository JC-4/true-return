import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

type IndexEntry = { id: string; name: string; savedAt: string; updatedAt?: string }
type Params = { params: Promise<{ id: string }> }

// The index is stored as a JSON string (SET key value), not a Redis set.
// Explicitly parse so it works whether Upstash auto-deserializes or returns the raw string.
async function readIndex(userId: string): Promise<IndexEntry[]> {
  const raw = await redis.get(`deals:${userId}`)
  if (!raw) return []
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as IndexEntry[] } catch { return [] }
  }
  return raw as IndexEntry[]
}

async function writeIndex(userId: string, index: IndexEntry[]): Promise<void> {
  await redis.set(`deals:${userId}`, JSON.stringify(index))
}

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

  const index = await readIndex(userId)
  const i = index.findIndex(e => e.id === id)
  if (i >= 0) index[i] = { ...index[i], name: body.name ?? index[i].name, updatedAt }
  await writeIndex(userId, index)

  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  await redis.del(`deal:${userId}:${id}`)

  const index = await readIndex(userId)
  await writeIndex(userId, index.filter(e => e.id !== id))

  return NextResponse.json({ ok: true })
}
