import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

const BUCKET = 'project-documents'
const SIGNED_URL_TTL = 3600 // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params
  const supabase = createServiceClient()

  // List all files in project-documents/{slug}/
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(slug, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })

  if (error) {
    console.error('[documents]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter out placeholder/empty entries (Supabase lists folders as entries with no metadata)
  const realFiles = (files ?? []).filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder')

  if (realFiles.length === 0) return NextResponse.json([])

  // Generate signed URLs for all files in parallel
  const docs = await Promise.all(
    realFiles.map(async file => {
      const path = `${slug}/${file.name}`
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL)

      const sizeBytes: number = (file.metadata as { size?: number } | null)?.size ?? 0
      const mimeType: string = (file.metadata as { mimetype?: string } | null)?.mimetype ?? 'application/octet-stream'

      return {
        name: file.name,
        sizeBytes,
        mimeType,
        signedUrl: signed?.signedUrl ?? null,
        signError: signErr?.message ?? null,
      }
    })
  )

  return NextResponse.json(docs)
}
