import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

type IndexEntry = { id: string; name: string; savedAt: string; updatedAt?: string }

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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const index = await readIndex(userId)

  // When ?projectSlug= is provided, return full deal params filtered to that project
  const projectSlug = new URL(req.url).searchParams.get('projectSlug')
  if (projectSlug) {
    const deals = await Promise.all(
      index.map(entry => redis.get<{ params: Record<string, unknown> } & IndexEntry>(`deal:${userId}:${entry.id}`))
    )
    const filtered = deals
      .filter((d): d is NonNullable<typeof d> => !!d && d.params?.projectSlug === projectSlug)
      .map(d => ({ id: d.id, name: d.name, savedAt: d.savedAt, params: d.params }))
    return NextResponse.json(filtered)
  }

  return NextResponse.json(index)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const body = await req.json()
  const id = generateId()
  const savedAt = new Date().toISOString()

  await redis.set(`deal:${userId}:${id}`, { id, savedAt, ...body })

  const index = await readIndex(userId)
  index.unshift({ id, name: body.name, savedAt })
  await writeIndex(userId, index)

  return NextResponse.json({ id })
}
