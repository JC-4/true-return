import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

type IndexEntry = { id: string; username: string; status: 'active' | 'pending'; createdAt: string }

export async function POST(req: NextRequest) {
  const { name, username, reason } = await req.json() as { name?: string; username?: string; reason?: string }

  if (!name?.trim() || !username?.trim()) {
    return NextResponse.json({ error: 'Name and username are required.' }, { status: 400 })
  }

  const index = await redis.get<IndexEntry[]>('users:index') ?? []
  if (index.find(u => u.username === username)) {
    return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 })
  }

  const id = generateId()
  const createdAt = new Date().toISOString()

  await Promise.all([
    redis.set(`user:${id}`, { id, username, name, reason: reason ?? '', status: 'pending', createdAt }),
    redis.set('users:index', [...index, { id, username, status: 'pending', createdAt }]),
  ])

  return NextResponse.json({ ok: true })
}
