import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// TODO: replace with auth().userId when auth is added
const USER_ID = 'jc'

type IndexEntry = { id: string; name: string; savedAt: string; updatedAt?: string }
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const deal = await redis.get(`deal:${USER_ID}:${id}`)
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(deal)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const body = await req.json()
  const updatedAt = new Date().toISOString()

  const existing = await redis.get<Record<string, unknown>>(`deal:${USER_ID}:${id}`)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await redis.set(`deal:${USER_ID}:${id}`, { ...existing, ...body, id, updatedAt })

  const index = await redis.get<IndexEntry[]>(`deals:${USER_ID}`) ?? []
  const i = index.findIndex(e => e.id === id)
  if (i >= 0) index[i] = { ...index[i], name: body.name ?? index[i].name, updatedAt }
  await redis.set(`deals:${USER_ID}`, index)

  return NextResponse.json({ id })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params

  await redis.del(`deal:${USER_ID}:${id}`)

  const index = await redis.get<IndexEntry[]>(`deals:${USER_ID}`) ?? []
  await redis.set(`deals:${USER_ID}`, index.filter(e => e.id !== id))

  return NextResponse.json({ ok: true })
}
