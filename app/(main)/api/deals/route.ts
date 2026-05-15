import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId(length = 6): string {
  let id = ''
  for (let i = 0; i < length; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return id
}

export async function POST(req: NextRequest) {
  const params = await req.json()
  const id = generateId()
  // Store for 90 days
  await redis.set(`deal:${id}`, params, { ex: 60 * 60 * 24 * 90 })
  return NextResponse.json({ id })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }
  const data = await redis.get(`deal:${id}`)
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(data)
}
