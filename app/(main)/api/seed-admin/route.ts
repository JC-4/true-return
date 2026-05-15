import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { redis } from '@/lib/redis'

type IndexEntry = { id: string; username: string; status: 'active' | 'pending'; createdAt: string }

export async function GET() {
  const existing = await redis.get('user:jc')
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Admin already exists — skipped' })
  }

  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    return NextResponse.json({ error: 'ADMIN_USERNAME and ADMIN_PASSWORD env vars required' }, { status: 500 })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const createdAt = new Date().toISOString()

  const user = {
    id: 'jc',
    username,
    passwordHash,
    name: 'Jackson',
    status: 'active' as const,
    createdAt,
  }

  const index = await redis.get<IndexEntry[]>('users:index') ?? []
  if (!index.find(u => u.id === 'jc')) {
    index.push({ id: 'jc', username, status: 'active', createdAt })
  }

  await Promise.all([
    redis.set('user:jc', user),
    redis.set('users:index', index),
  ])

  return NextResponse.json({ ok: true, message: 'Admin user created' })
}
