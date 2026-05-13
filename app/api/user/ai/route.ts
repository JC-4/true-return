import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { redis } from '@/lib/redis'

// Delimiter written at the end of the stream to signal a system/record-update message
const SYS_MARKER = '\x00SYS:'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'
function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

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

const CAPABILITIES = `
## CAPABILITIES — YOU CAN DO THESE THINGS:
- Create new clients: just confirm the details with the user and say you're adding them. The system will detect this and write to the database automatically after your response.
- Update existing clients: state what you're changing and it will be written to the database.
- You DO have write access to the CRM. When a user asks you to add or update a client, do it — don't tell them to do it manually.`

function buildGeneralPrompt(clients: ClientRecord[], today: string, knowledge: string | null): string {
  const knowledgeSection = knowledge ? `\n\n## MARKET KNOWLEDGE BASE\n\n${knowledge}` : ''
  return `You are Jackson's personal Dubai real estate CRM assistant. You are his second brain — direct, sharp, commercially aware. You have full context on all his clients below. You can advise on who to contact, what to say, what to pitch, draft WhatsApp messages, suggest properties. Today's date is ${today}. Keep responses concise unless drafting a message. Use bold for names and key figures.
${CAPABILITIES}

# Clients

${clients.map(clientBlock).join('\n\n')}${knowledgeSection}`
}

function buildClientPrompt(focused: ClientRecord, others: ClientRecord[], today: string, knowledge: string | null): string {
  const otherBrief = others.length
    ? others.map(c => `- **${c.name}**: ${c.status}, ${c.propertyType || '—'}, ${fmtAED(c.minBudgetAED)}–${fmtAED(c.maxBudgetAED)}`).join('\n')
    : 'None'
  const knowledgeSection = knowledge ? `\n\n## MARKET KNOWLEDGE BASE\n\n${knowledge}` : ''

  return `You are Jackson's personal Dubai real estate CRM assistant — direct, sharp, commercially aware. Currently focused on client **${focused.name}**. Today's date is ${today}. Keep responses concise unless drafting a message. Use bold for names and key figures.
${CAPABILITIES}

# Focused client

${clientBlock(focused)}

# Other clients (brief reference)

${otherBrief}${knowledgeSection}`
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

  // Fetch clients index + knowledge base in parallel
  const [index, knowledge] = await Promise.all([
    redis.get<IndexEntry[]>(`clients:${userId}`).then(r => r ?? []),
    redis.get<string>(`knowledge:${userId}`).then(r => r ?? null),
  ])

  const clients = await Promise.all(
    index.map(e => redis.get<ClientRecord>(`client:${userId}:${e.id}`))
  ).then(results => results.filter((c): c is ClientRecord => c !== null))

  const focusedClient = clientId ? clients.find(c => c.id === clientId) ?? null : null
  const otherClients = focusedClient ? clients.filter(c => c.id !== clientId) : clients

  const systemPrompt = focusedClient
    ? buildClientPrompt(focusedClient, otherClients, todayStr, knowledge)
    : buildGeneralPrompt(clients, todayStr, knowledge)

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
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
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

      const conversationText = [
        ...messages.map(m => `${m.role}: ${m.content}`),
        `assistant: ${fullResponse}`,
      ].join('\n')

      // Auto-update client record if this is a per-client chat
      if (focusedClient) {
        try {
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
      } else {
        // General mode: check if the conversation requested a new client to be created
        try {
          const intentCheck = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 512,
            system: 'You are a JSON extractor. Return only a valid JSON object, no markdown fences, no explanation.',
            messages: [{
              role: 'user',
              content: `If the user asked to add or create a new client in this conversation, extract the client details and return ONLY a JSON object in this format: { "action": "create_client", "data": { "name": "", "status": "Active", "market": [], "propertyType": "", "minBudgetAED": null, "maxBudgetAED": null, "notes": "", "followUpAction": "", "nextFollowUp": null } }. If no client creation was requested, return { "action": "none" }.

Rules:
- market must be an array containing "Off Plan", "Secondary", or both, or []
- minBudgetAED and maxBudgetAED must be numbers (e.g. 1500000) or null
- For nextFollowUp, ONLY return a date in exactly this format: YYYY-MM-DD (e.g. ${todayStr}). If no specific date was mentioned, return null. Never return relative dates like "tomorrow" or "next week" — calculate the actual date based on today being ${todayStr}.
- notes and followUpAction should be empty strings if not mentioned

Conversation:
${conversationText}`,
            }],
          })

          const raw = intentCheck.content[0]?.type === 'text' ? intentCheck.content[0].text.trim() : '{}'
          const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
          const intent = JSON.parse(jsonStr) as { action: string; data?: Record<string, unknown> }

          if (intent.action === 'create_client' && typeof intent.data?.name === 'string' && intent.data.name.trim()) {
            const newId = generateId()
            const savedAt = new Date().toISOString()
            // Sanitize: ensure nextFollowUp is YYYY-MM-DD or omitted
            const d = intent.data
            if (typeof d.nextFollowUp === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(d.nextFollowUp)) {
              d.nextFollowUp = null
            }
            const clientData = {
              id: newId,
              savedAt,
              updatedAt: savedAt,
              status: 'Active',
              market: [] as string[],
              ...d,
            }
            await redis.set(`client:${userId}:${newId}`, clientData)
            const idx = await redis.get<IndexEntry[]>(`clients:${userId}`) ?? []
            idx.unshift({ id: newId, name: intent.data.name.trim(), status: (intent.data.status as string) ?? 'Active', savedAt, updatedAt: savedAt })
            await redis.set(`clients:${userId}`, idx)
            await writer.write(encoder.encode(`${SYS_MARKER}Client "${intent.data.name.trim()}" added to your CRM.`))
          }
        } catch (err) {
          console.error('[AI route] Client creation check error:', err)
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
