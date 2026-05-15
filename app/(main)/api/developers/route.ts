import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('developers')
    .select('*, projects(id)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const developers = (data ?? []).map(d => ({
    ...d,
    project_count: Array.isArray(d.projects) ? d.projects.length : 0,
    projects: undefined,
  }))

  return NextResponse.json(developers)
}
