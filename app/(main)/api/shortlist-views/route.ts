import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Logs a shortlist view event. Client-side only (see ShortlistViewLogger):
// link-preview crawlers don't run JS, so server-side logging counted a
// WhatsApp preview fetch as an open. The token authorises the write — the
// anon key cannot touch shortlist tables directly.
export async function POST(req: Request) {
  let body: { token?: unknown; event?: unknown; entryId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { token, event, entryId } = body
  if (typeof token !== 'string' || (event !== 'open' && event !== 'expand')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: shortlist } = await supabase
    .from('shortlists')
    .select('id')
    .eq('token', token)
    .single()
  if (!shortlist) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Analytics: swallow insert failures rather than surfacing them
  await supabase.from('shortlist_views').insert({
    shortlist_id: shortlist.id,
    event,
    ...(typeof entryId === 'string' && entryId ? { entry_id: entryId } : {}),
  })

  return NextResponse.json({ ok: true })
}
