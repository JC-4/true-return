import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase, createServiceClient } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

/** Rows arriving from the editor. New rows have no id yet. */
type DeliveredPayload = {
  id?: string | null
  name: string
  location: string | null
  year: number | null
  image_url: string | null
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params

  const { data: developer, error: devErr } = await supabase
    .from('developers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (devErr) {
    const status = devErr.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: devErr.message }, { status })
  }

  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .eq('developer_id', developer.id)
    .order('created_at', { ascending: false })

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 })

  return NextResponse.json({ ...developer, projects: projects ?? [] })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const { developer: devFields, delivered } = await req.json() as {
    developer: Record<string, unknown>
    delivered?: DeliveredPayload[]
  }

  const service = createServiceClient()

  // Update by slug, but read the id back — slug itself is editable, so the
  // delivered sync below must key off the id, not the (possibly stale) slug.
  const { data: updated, error: devError } = await service
    .from('developers')
    .update(devFields)
    .eq('slug', slug)
    .select('id')
    .single()

  if (devError) return NextResponse.json({ error: devError.message }, { status: 500 })

  if (delivered) {
    const developerId = updated.id

    // Drop rows the editor removed.
    const keepIds = delivered.map(d => d.id).filter((id): id is string => Boolean(id))
    let del = service.from('developer_delivered_projects').delete().eq('developer_id', developerId)
    if (keepIds.length) del = del.not('id', 'in', `(${keepIds.join(',')})`)
    const { error: delError } = await del
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    // sort_order is derived from array position — the editor owns the ordering.
    const rows = delivered.map((d, i) => ({
      id: d.id ?? null,
      developer_id: developerId,
      name: d.name,
      location: d.location,
      year: d.year,
      image_url: d.image_url,
      sort_order: i,
    }))

    // Existing and new rows go in separate calls. A single upsert would build one
    // INSERT with a shared column list, sending an explicit null id for the new
    // rows instead of letting gen_random_uuid() fill it in.
    const existing = rows.filter(r => r.id !== null)
    const created = rows.filter(r => r.id === null).map(({ id: _id, ...rest }) => rest)

    if (existing.length) {
      const { error: upsertError } = await service
        .from('developer_delivered_projects')
        .upsert(existing)
      if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    if (created.length) {
      const { error: insertError } = await service
        .from('developer_delivered_projects')
        .insert(created)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
