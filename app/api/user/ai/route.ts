import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { redis } from '@/lib/redis'

// Delimiter written at the end of the stream to signal a system/record-update message
const SYS_MARKER = '\x00SYS:'

type ClientRecord = {
  id: string
  name: string
  status: string
  market?: string[]
  propertyType?: string
  minBudgetAED?: number
  maxBudgetAED?: number
  mortgageStatus?: string
  lastContacted?: string
  nextFollowUp?: string
  followUpAction?: string
  notes?: string
  savedAt: string
  updatedAt: string
}

type IndexEntry = { id: string; name: string; status: string; savedAt: string; updatedAt?: string }

type Message = { role: 'user' | 'assistant'; content: string }

function fmtAED(n?: number) {
  if (!n) return '—'
  return `AED ${(n / 1_000_000).toFixed(1)}M`
}

function clientBlock(c: ClientRecord): string {
  const budget =
    c.minBudgetAED || c.maxBudgetAED
      ? `${fmtAED(c.minBudgetAED)}–${fmtAED(c.maxBudgetAED)}`
      : '—'
  return [
    `## ${c.name} (ID: ${c.id})`,
    `Status: ${c.status}`,
    `Market: ${c.market?.join(', ') || '—'}`,
    `Property type: ${c.propertyType || '—'}`,
    `Budget: ${budget}`,
    c.mortgageStatus ? `Mortgage: ${c.mortgageStatus}` : '',
    c.lastContacted ? `Last contacted: ${c.lastContacted}` : '',
    c.nextFollowUp ? `Next follow-up: ${c.nextFollowUp}` : '',
    c.followUpAction ? `Follow-up action: ${c.followUpAction}` : '',
    c.notes ? `Notes: ${c.notes}` : '',
  ].filter(Boolean).join('\n')
}

function buildGeneralPrompt(clients: ClientRecord[], today: string): string {
  return `You are Jackson's personal Dubai real estate CRM assistant. You are his second brain — direct, sharp, commercially aware. You have full context on all his clients below. You can advise on who to contact, what to say, what to pitch, draft WhatsApp messages, suggest properties. Today's date is ${today}. Keep responses concise unless drafting a message. Use bold for names and key figures.

# Clients

${clients.map(clientBlock).join('\n\n')}`
}

function buildClientPrompt(focused: ClientRecord, others: ClientRecord[], today: string): string {
  const otherBrief = others.length
    ? others.map(c => `- **${c.name}**: ${c.status}, ${c.propertyType || '—'}, ${fmtAED(c.minBudgetAED)}–${fmtAED(c.maxBudgetAED)}`).join('\n')
    : 'None'

  return `You are Jackson's personal Dubai real estate CRM assistant — direct, sharp, commercially aware. Currently focused on client **${focused.name}**. Today's date is ${today}. Keep responses concise unless drafting a message. Use bold for names and key figures.

# Focused client

${clientBlock(focused)}

# Other clients (brief reference)

${otherBrief}`
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const { messages, today, clientId } = await req.json() as {
    messages: Message[]
    today: string
    clientId?: string | null
  }

  const todayStr = today || new Date().toISOString().split('T')[0]

  const index = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
  const clients = await Promise.all(
    index.map(e => redis.get<ClientRecord>(`client:${userId}:${e.id}`))
  ).then(results => results.filter((c): c is ClientRecord => c !== null))

  const focusedClient = clientId ? clients.find(c => c.id === clientId) ?? null : null
  const otherClients = focusedClient ? clients.filter(c => c.id !== clientId) : clients

  const systemPrompt = focusedClient
    ? buildClientPrompt(focusedClient, otherClients, todayStr)
    : buildGeneralPrompt(clients, todayStr)

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  ;(async () => {
    let fullResponse = ''
    try {
      const messageStream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      })

      for await (const event of messageStream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          fullResponse += event.delta.text
          await writer.write(encoder.encode(event.delta.text))
        }
      }

      // Auto-update client record if this is a per-client chat
      if (focusedClient) {
        try {
          const conversationText = [
            ...messages.map(m => `${m.role}: ${m.content}`),
            `assistant: ${fullResponse}`,
          ].join('\n')

          const extraction = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: 'You are a JSON extractor. Return only a valid JSON object, no markdown fences, no explanation.',
            messages: [{
              role: 'user',
              content: `Based on this conversation about client "${focusedClient.name}", determine which CRM fields should be updated.

Today's date: ${todayStr}
Current record:
${JSON.stringify(focusedClient, null, 2)}

Conversation:
${conversationText}

Return a JSON object with only the fields that should change. Allowed fields: notes, followUpAction, lastContacted, nextFollowUp.
Rules:
- Only update if the conversation contains clear new information
- notes: append new info to existing notes, don't rewrite from scratch
- lastContacted: use today's date (${todayStr}) only if Jackson actually spoke with this client in the conversation
- nextFollowUp: only if a specific date was clearly agreed or mentioned
- Return {} if nothing should change`,
            }],
          })

          const raw = extraction.content[0]?.type === 'text' ? extraction.content[0].text.trim() : '{}'
          const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
          const updates = JSON.parse(jsonStr) as Record<string, string>

          if (Object.keys(updates).length > 0) {
            const existing = await redis.get<Record<string, unknown>>(`client:${userId}:${clientId}`)
            if (existing) {
              const updatedAt = new Date().toISOString()
              await redis.set(`client:${userId}:${clientId}`, { ...existing, ...updates, id: clientId, updatedAt })

              const idx = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
              const pos = idx.findIndex(e => e.id === clientId)
              if (pos >= 0) idx[pos] = { ...idx[pos], updatedAt }
              await redis.set(`clients:${userId}`, idx)

              const changedFields = Object.keys(updates).join(', ')
              await writer.write(encoder.encode(`${SYS_MARKER}Record updated: ${changedFields}`))
            }
          }
        } catch (err) {
          console.error('[AI route] Auto-update error:', err)
        }
      }
    } catch (error) {
      console.error('[AI route] Stream error:', error)
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
