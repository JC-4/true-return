import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

type StoredMessage = { role: 'user' | 'assistant'; content: string; timestamp: string }
type IndexEntry = { id: string; name: string; status: string; savedAt: string; updatedAt?: string }
type ClientRecord = Record<string, unknown> & { id: string; name: string; notes?: string; updatedAt: string }
type UpdateItem = {
  id?: string
  notes?: string
  followUpAction?: string
  nextFollowUp?: string | null
  lastContacted?: string | null
}
type Params = { params: Promise<{ id: string }> }

async function getUserId() {
  const session = await getServerSession(authOptions)
  return session?.user ? (session.user as { id?: string }).id! : null
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { today?: string }
  const todayStr = body.today || new Date().toISOString().split('T')[0]

  const messages = await redis.get<StoredMessage[]>(`chat:${userId}:${id}`) ?? []

  // Nothing to summarise — just clear and return
  if (messages.length === 0) {
    await redis.del(`chat:${userId}:${id}`)
    return NextResponse.json({ ok: true, updatesApplied: 0 })
  }

  // Fetch client records for summarisation context
  const index = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
  const clientRecords = await Promise.all(
    index.map(e => redis.get<ClientRecord>(`client:${userId}:${e.id}`))
  ).then(rs => rs.filter((c): c is ClientRecord => c !== null))

  const clientContext = clientRecords.length > 0
    ? clientRecords.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')
    : '(no clients)'

  const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n')

  let updatesApplied = 0
  let warning: string | undefined

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const result = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a JSON extractor. Return only a valid JSON array, no markdown fences, no explanation.',
      messages: [{
        role: 'user',
        content: `Review this conversation and extract any new information that should be saved to client records. For each client mentioned, return a JSON array of updates in this format:
[{ "id": "CLIENT_ID", "notes": "appended note", "followUpAction": "updated action", "nextFollowUp": "YYYY-MM-DD or null", "lastContacted": "YYYY-MM-DD or null" }]
Only include fields that have genuinely new information from this conversation. If nothing needs updating, return an empty array []. Today is ${todayStr}.

Known clients (use exact IDs):
${clientContext}

Conversation:
${conversationText}`,
      }],
    })

    const raw = result.content[0]?.type === 'text' ? result.content[0].text.trim() : '[]'
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const updates = JSON.parse(jsonStr) as UpdateItem[]

    for (const update of updates) {
      if (!update.id) continue
      const existing = await redis.get<ClientRecord>(`client:${userId}:${update.id}`)
      if (!existing) continue

      const patch: Record<string, unknown> = {}

      if (update.notes?.trim()) {
        const prev = typeof existing.notes === 'string' ? existing.notes : ''
        patch.notes = prev
          ? `${prev}\n[${todayStr}] ${update.notes.trim()}`
          : `[${todayStr}] ${update.notes.trim()}`
      }
      if (update.followUpAction?.trim()) {
        patch.followUpAction = update.followUpAction.trim()
      }
      if (update.nextFollowUp && /^\d{4}-\d{2}-\d{2}$/.test(update.nextFollowUp)) {
        patch.nextFollowUp = update.nextFollowUp
      }
      if (update.lastContacted && /^\d{4}-\d{2}-\d{2}$/.test(update.lastContacted)) {
        patch.lastContacted = update.lastContacted
      }

      if (Object.keys(patch).length === 0) continue

      const updatedAt = new Date().toISOString()
      await redis.set(`client:${userId}:${update.id}`, { ...existing, ...patch, updatedAt })

      // Keep index updatedAt in sync
      const idx = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
      const pos = idx.findIndex(e => e.id === update.id)
      if (pos >= 0) {
        idx[pos] = { ...idx[pos], updatedAt }
        await redis.set(`clients:${userId}`, idx)
      }

      updatesApplied++
    }
  } catch (err) {
    console.error('[clear] Summarisation failed:', err)
    warning = 'updates could not be saved automatically'
  }

  // Always delete chat history regardless of summarisation outcome
  await redis.del(`chat:${userId}:${id}`)

  return NextResponse.json({ ok: true, updatesApplied, warning })
}
