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

type IndexEntry = { id: string; name: string; status: string; savedAt: string; updatedAt?: string }

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const index = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
  return NextResponse.json(index)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const body = await req.json()
  const id = generateId()
  const savedAt = new Date().toISOString()

  await redis.set(`client:${userId}:${id}`, { id, savedAt, ...body })

  const index = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
  index.unshift({ id, name: body.name, status: body.status ?? 'Active', savedAt })
  await redis.set(`clients:${userId}`, index)

  return NextResponse.json({ id })
}
