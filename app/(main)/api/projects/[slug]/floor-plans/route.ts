import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const unitTypeId = formData.get('unitTypeId') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!unitTypeId) return NextResponse.json({ error: 'No unitTypeId provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `floor-plans/${slug}/${unitTypeId}.${ext}`

  const service = createServiceClient()
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await service.storage
    .from('project-images')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[floor-plans/upload]', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('project-images').getPublicUrl(path)

  const { error: dbError } = await service
    .from('unit_types')
    .update({ floor_plan_url: publicUrl })
    .eq('id', unitTypeId)

  if (dbError) {
    console.error('[floor-plans/db-update]', dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ publicUrl })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { unitTypeId } = await req.json() as { unitTypeId?: string }
  if (!unitTypeId) return NextResponse.json({ error: 'No unitTypeId provided' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service
    .from('unit_types')
    .update({ floor_plan_url: null })
    .eq('id', unitTypeId)

  if (error) {
    console.error('[floor-plans/delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
