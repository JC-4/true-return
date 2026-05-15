import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params

  const { data: developer, error: devErr } = await supabase
    .from('developers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (devErr) {
    const status = devErr.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: devErr.message }, { status })
  }

  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*, developer:developers(*)')
    .eq('developer_id', developer.id)
    .order('created_at', { ascending: false })

  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 })

  return NextResponse.json({ ...developer, projects: projects ?? [] })
}
