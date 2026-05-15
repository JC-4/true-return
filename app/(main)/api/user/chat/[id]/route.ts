import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

const MAX_MESSAGES = 20

type StoredMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }
type Params = { params: Promise<{ id: string }> }

async function getUserId() {
  const session = await getServerSession(authOptions)
  return session?.user ? (session.user as { id?: string }).id! : null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const messages = await redis.get<StoredMessage[]>(`chat:${userId}:${id}`) ?? []
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as {
    role?: string
    content?: string
    messages?: Array<{ role: string; content: string }>
  }

  const timestamp = new Date().toISOString()
  const stored = await redis.get<StoredMessage[]>(`chat:${userId}:${id}`) ?? []

  // Accept either a single {role,content} or a batch {messages:[...]}
  const incoming: StoredMessage[] = body.messages
    ? body.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content, timestamp }))
    : [{ role: body.role as 'user' | 'assistant', content: body.content!, timestamp }]

  stored.push(...incoming)
  if (stored.length > MAX_MESSAGES) {
    stored.splice(0, stored.length - MAX_MESSAGES)
  }

  await redis.set(`chat:${userId}:${id}`, stored)
  console.log(`[chat:${id}] saved ${incoming.length} msg(s), total ${stored.length}`)
  return NextResponse.json({ ok: true })
}
