import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const service = createServiceClient()

  const { data: project, error: projError } = await service
    .from('projects')
    .select('id')
    .eq('slug', slug)
    .single()

  if (projError || !project)
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { data, error } = await service
    .from('unit_types')
    .insert({ project_id: project.id, type: 'New unit type', bedrooms: 0 })
    .select()
    .single()

  if (error) {
    console.error('[unit-types/create]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'No id provided' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('unit_types').delete().eq('id', id)

  if (error) {
    console.error('[unit-types/delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
