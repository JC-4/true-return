import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// TODO: replace with auth().userId when auth is added
const USER_ID = 'jc'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

type IndexEntry = { id: string; name: string; savedAt: string; updatedAt?: string }

export async function GET() {
  const index = await redis.get<IndexEntry[]>(`deals:${USER_ID}`) ?? []
  return NextResponse.json(index)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const id = generateId()
  const savedAt = new Date().toISOString()

  await redis.set(`deal:${USER_ID}:${id}`, { id, savedAt, ...body })

  const index = await redis.get<IndexEntry[]>(`deals:${USER_ID}`) ?? []
  index.unshift({ id, name: body.name, savedAt })
  await redis.set(`deals:${USER_ID}`, index)

  return NextResponse.json({ id })
}
