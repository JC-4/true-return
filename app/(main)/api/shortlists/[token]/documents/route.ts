import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { listProjectDocuments } from '@/lib/project-documents'

// Token-authorised variant of /api/projects/[slug]/documents: a shortlist
// token entitles the holder to documents for projects on that shortlist only.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: shortlist } = await supabase
    .from('shortlists')
    .select('id, entries:shortlist_entries(project:projects(slug))')
    .eq('token', token)
    .single()

  // Untyped client infers the to-one project embed as an array; it's an object
  const entries = (shortlist?.entries ?? []) as unknown as { project: { slug: string } | null }[]
  const allowed = entries.some(e => e.project?.slug === slug)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    return NextResponse.json(await listProjectDocuments(slug))
  } catch (err) {
    console.error('[shortlist documents]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to load documents.' }, { status: 500 })
  }
}
