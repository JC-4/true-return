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
  const service = createServiceClient()
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await req.json() as { url?: string }
    if (!body.url) return NextResponse.json({ error: 'No url provided' }, { status: 400 })

    const { error: dbError } = await service
      .from('projects')
      .update({ about_image_url: body.url })
      .eq('slug', slug)

    if (dbError) {
      console.error('[about-image/db-update-url]', dbError)
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    return NextResponse.json({ publicUrl: body.url })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `projects/${slug}/about-image.${ext}`

  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await service.storage
    .from('project-images')
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[about-image/upload]', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('project-images').getPublicUrl(path)

  const { error: dbError } = await service
    .from('projects')
    .update({ about_image_url: publicUrl })
    .eq('slug', slug)

  if (dbError) {
    console.error('[about-image/db-update]', dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ publicUrl })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.email !== process.env.ADMIN_USERNAME)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slug } = await params
  const service = createServiceClient()

  const { error } = await service
    .from('projects')
    .update({ about_image_url: null })
    .eq('slug', slug)

  if (error) {
    console.error('[about-image/delete]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
