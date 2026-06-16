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
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `projects/${slug}/${Date.now()}-${safeName}`

  const service = createServiceClient()
  const bytes = await file.arrayBuffer()

  const { error } = await service.storage
    .from('project-images')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false })

  if (error) {
    console.error('[images/upload] Supabase storage error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('project-images').getPublicUrl(path)
  return NextResponse.json({ publicUrl })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { path } = await req.json() as { path?: string }
  if (!path) return NextResponse.json({ error: 'No path provided' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.storage.from('project-images').remove([path])

  if (error) {
    console.error('[images/delete] Supabase storage error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
