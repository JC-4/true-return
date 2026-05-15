import { NextRequest, NextResponse } from 'next/server'
import { supabase, createServiceClient } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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
