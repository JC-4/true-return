import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listProjectDocuments } from '@/lib/project-documents'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { slug } = await params

  try {
    return NextResponse.json(await listProjectDocuments(slug))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load documents.'
    console.error('[documents]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
