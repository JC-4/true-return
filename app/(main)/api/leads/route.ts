import { NextRequest, NextResponse } from 'next/server'
import { clientIp, rateLimit, humanRetry } from '@/lib/rate-limit'

const MAKE_WEBHOOK = 'https://hook.eu2.make.com/5prfp4iixgyoi5416yhszlaq32514cow'

// One genuine enquiry is a single POST followed by a single PATCH. The limits
// leave room for a visitor who retries after a network error or fills the form
// in twice, and nothing like enough for a script.
const POST_LIMIT = 5
const PATCH_LIMIT = 10
const WINDOW_SECONDS = 10 * 60

/** Honeypot submissions get a well-formed response carrying this prefix, so the
 *  follow-up PATCH can be dropped too without the caller learning anything. */
const HONEYPOT_PREFIX = 'hp_'

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: `Too many enquiries from this connection. Try again in ${humanRetry(retryAfter)}, or message us on WhatsApp.` },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req)
  const limit = await rateLimit('leads:post', ip, POST_LIMIT, WINDOW_SECONDS)
  if (!limit.ok) return tooMany(limit.retryAfter)

  const { name, email, phone, project_slug, source, referrer, utm_source, utm_campaign, contact_reference } =
    await req.json() as {
      name: string
      email: string
      phone?: string
      project_slug?: string
      source?: string
      referrer?: string
      utm_source?: string
      utm_campaign?: string
      /** Honeypot. Hidden from users, so anything here came from a bot. */
      contact_reference?: string
    }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  // Drop silently rather than 400: a bot that is told it was caught just
  // adapts. This one gets a normal-looking success and a lead_id that goes
  // nowhere, and nothing reaches Make.
  if (contact_reference?.trim()) {
    console.warn('[leads] honeypot filled, dropping submission from', ip)
    return NextResponse.json({ ok: true, lead_id: `${HONEYPOT_PREFIX}${crypto.randomUUID()}` })
  }

  const lead_id = crypto.randomUUID()

  try {
    const res = await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'created', lead_id, name, email, phone, project_slug, source, referrer, utm_source, utm_campaign }),
    })
    if (!res.ok) {
      console.error('Make webhook error (POST):', res.status, await res.text())
      return NextResponse.json({ error: "We couldn't record that enquiry." }, { status: 502 })
    }
  } catch (err) {
    console.error('Make webhook fetch failed (POST):', err)
    return NextResponse.json({ error: "We couldn't record that enquiry." }, { status: 502 })
  }

  return NextResponse.json({ ok: true, lead_id })
}

export async function PATCH(req: NextRequest) {
  const ip = clientIp(req)
  const limit = await rateLimit('leads:patch', ip, PATCH_LIMIT, WINDOW_SECONDS)
  if (!limit.ok) return tooMany(limit.retryAfter)

  const { lead_id, budget, timeline, message } =
    await req.json() as {
      lead_id: string
      budget?: string
      timeline?: string
      message?: string
    }

  if (!lead_id?.trim()) {
    return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
  }

  // The POST was a honeypot hit; there is no lead in Make to complete.
  if (lead_id.startsWith(HONEYPOT_PREFIX)) {
    return NextResponse.json({ ok: true })
  }

  try {
    const res = await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'completed', lead_id, budget, timeline, message }),
    })
    if (!res.ok) {
      console.error('Make webhook error (PATCH):', res.status, await res.text())
      return NextResponse.json({ error: "We couldn't attach those details." }, { status: 502 })
    }
  } catch (err) {
    console.error('Make webhook fetch failed (PATCH):', err)
    return NextResponse.json({ error: "We couldn't attach those details." }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
