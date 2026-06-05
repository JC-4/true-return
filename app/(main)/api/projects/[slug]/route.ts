import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase, createServiceClient } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params

  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const { project: projectFields, unit_types } = await req.json() as {
    project: Record<string, unknown>
    unit_types: Array<{ id: string } & Record<string, unknown>>
  }

  const service = createServiceClient()

  const { error: projError } = await service
    .from('projects')
    .update(projectFields)
    .eq('slug', slug)

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 })

  for (const { id, ...fields } of unit_types) {
    const { error: utError } = await service
      .from('unit_types')
      .update(fields)
      .eq('id', id)
    if (utError) return NextResponse.json({ error: utError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
