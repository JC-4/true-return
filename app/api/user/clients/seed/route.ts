import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const existing = await redis.get(`clients:${userId}`)
  if (existing && Array.isArray(existing) && (existing as unknown[]).length > 0) {
    return NextResponse.json({ ok: true, message: 'Already seeded — skipped' })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const savedAt = now.toISOString()

  const clients = [
    {
      id: generateId(),
      name: 'Kieran & Christie',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 2_000_000,
      maxBudgetAED: 3_000_000,
      mortgageStatus: 'Mortgage (equity release)',
      nextFollowUp: today,
      followUpAction: 'Call Kieran — break news about Scope Properties pausing bookings, explore alternatives including Abu Dhabi and Ellington off plan.',
      notes: 'Sold them a villa ~18 months ago. Looking for investment property. Mortgage equity release on existing villa to free ~800k. Scope Properties (Wasl Gate) fell through — developer paused bookings due to geopolitical situation. Pitched Ellington off plan (7% guaranteed returns). Open to Abu Dhabi long-term.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Quentin',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Villa',
      nextFollowUp: addDays(now, 7),
      followUpAction: 'Find the right moment — don\'t push product. Re-engage gently.',
      notes: 'High-value slow-burn client. Sold him 3-bed Ellington House (3.8M, now worth ~6M), currently upgrading and moving in. Interested in off plan investments and future villa ~10–12M. Sent Hudayriyat info — interested but went silent on follow-up launch. Don\'t push product, find the right moment.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Michel & Nathalie',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 3_000_000,
      maxBudgetAED: 5_000_000,
      nextFollowUp: addDays(now, 3),
      followUpAction: 'Re-engage — check in and explore 2-bed Ellington House options.',
      notes: 'Sold them 1-bed Ellington House, currently rented out. Interested in buying 2-bed Ellington House to live in themselves. Open to off plan. Haven\'t spoken recently.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Shankar',
      status: 'Paused' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 1_500_000,
      maxBudgetAED: 3_000_000,
      nextFollowUp: addDays(now, 7),
      followUpAction: 'Soft re-engagement — relationship first, product second.',
      notes: 'Sold him 1-bed Ellington House. Was looking at selling it and upgrading to 2-bed in Fortimo Golf Residences, and an investment apartment in Abu Dhabi. Went cold when geopolitical conflict started. Needs soft re-engagement — relationship first, product second.',
      savedAt,
      updatedAt: savedAt,
    },
  ]

  const index = clients.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    savedAt: c.savedAt,
    updatedAt: c.updatedAt,
  }))

  await Promise.all([
    ...clients.map(c => redis.set(`client:${userId}:${c.id}`, c)),
    redis.set(`clients:${userId}`, index),
  ])

  return NextResponse.json({ ok: true, message: `Seeded ${clients.length} clients`, ids: clients.map(c => c.id) })
}
