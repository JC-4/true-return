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
  const { role, content } = await req.json() as { role: string; content: string }

  const timestamp = new Date().toISOString()
  const messages = await redis.get<StoredMessage[]>(`chat:${userId}:${id}`) ?? []

  messages.push({ role: role as 'user' | 'assistant', content, timestamp })

  if (messages.length > MAX_MESSAGES) {
    messages.splice(0, messages.length - MAX_MESSAGES)
  }

  await redis.set(`chat:${userId}:${id}`, messages)
  return NextResponse.json({ ok: true })
}
