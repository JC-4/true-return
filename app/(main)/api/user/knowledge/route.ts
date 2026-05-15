import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

async function getUserId() {
  const session = await getServerSession(authOptions)
  return session?.user ? (session.user as { id?: string }).id! : null
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const content = await redis.get<string>(`knowledge:${userId}`)
  return NextResponse.json({ content: content ?? null })
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { content?: string }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  await redis.set(`knowledge:${userId}`, body.content)
  return NextResponse.json({ ok: true })
}
