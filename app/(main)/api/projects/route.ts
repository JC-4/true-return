import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const developerId = searchParams.get('developerId')

  // Use service client so RLS on unit_types doesn't silently filter results
  const db = createServiceClient()
  let query = db
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .order('name')

  if (developerId) query = query.eq('developer_id', developerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const service = createServiceClient()

  const { data, error } = await service
    .from('projects')
    .upsert(body, { onConflict: 'slug' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
