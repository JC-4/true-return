import { NextRequest, NextResponse } from 'next/server'

const MAKE_WEBHOOK = 'https://hook.eu2.make.com/5prfp4iixgyoi5416yhszlaq32514cow'

export async function POST(req: NextRequest) {
  const { name, email, phone, project_slug, source, referrer, utm_source, utm_campaign } =
    await req.json() as {
      name: string
      email: string
      phone?: string
      project_slug?: string
      source?: string
      referrer?: string
      utm_source?: string
      utm_campaign?: string
    }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
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
    }
  } catch (err) {
    console.error('Make webhook fetch failed (POST):', err)
  }

  return NextResponse.json({ ok: true, lead_id })
}

export async function PATCH(req: NextRequest) {
  const { lead_id, budget, timeline, message } =
    await req.json() as {
      lead_id: string
      budget?: string
      timeline?: string
      message?: string
    }

  try {
    const res = await fetch(MAKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'completed', lead_id, budget, timeline, message }),
    })
    if (!res.ok) {
      console.error('Make webhook error (PATCH):', res.status, await res.text())
    }
  } catch (err) {
    console.error('Make webhook fetch failed (PATCH):', err)
  }

  return NextResponse.json({ ok: true })
}
