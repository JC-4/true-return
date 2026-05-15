import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = { params: Promise<{ slug: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug } = await params

  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json({ error: error.message }, { status })
  }
  return NextResponse.json(data)
}
