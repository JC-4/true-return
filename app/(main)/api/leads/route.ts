import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, phone, project_slug } = await req.json() as {
    name: string
    email: string
    phone?: string
    project_slug?: string
  }

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  const { error: insertErr } = await supabase
    .from('leads')
    .insert({ name: name.trim(), email: email.trim(), phone: phone?.trim() ?? null, project_slug: project_slug ?? null })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Fetch brochure_url for the project if a slug was provided
  let brochure_url: string | null = null
  if (project_slug) {
    const { data } = await supabase
      .from('projects')
      .select('brochure_url')
      .eq('slug', project_slug)
      .single()
    brochure_url = data?.brochure_url ?? null
  }

  return NextResponse.json({ ok: true, brochure_url })
}
