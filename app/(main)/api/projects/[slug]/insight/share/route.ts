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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const body = await req.json() as { params: Record<string, unknown> }
  const id = generateId()
  const savedAt = new Date().toISOString()

  await redis.set(`insight-share:${slug}:${id}`, { id, slug, savedAt, params: body.params })

  const origin = process.env.NEXTAUTH_URL ?? ''
  const url = `${origin}/projects/${slug}/insight/${id}`
  return NextResponse.json({ id, url })
}
