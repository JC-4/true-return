import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type Row = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  reviewed_at: string | null
  delivery_record: string | null
  at_a_glance: unknown
  projects: { id: string }[] | null
}

export default async function AdminDevelopersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/admin/developers')
  if (session.user.email !== process.env.ADMIN_USERNAME) redirect('/')

  const { data, error } = await supabase
    .from('developers')
    .select('id, slug, name, logo_url, reviewed_at, delivery_record, at_a_glance, projects(id)')
    .order('name')

  const developers = (data ?? []) as Row[]

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        <div className="mb-8">
          <p className="text-[#27272a] text-xs font-semibold uppercase tracking-widest mb-2">
            Admin · Private
          </p>
          <h1 className="text-2xl font-bold text-[#18181b] mb-1">Developers</h1>
          <p className="text-sm text-[#71717a]">
            {developers.length} developer{developers.length === 1 ? '' : 's'}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error.message}</p>
        )}

        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
          {developers.map(dev => {
            const glanceCount = Array.isArray(dev.at_a_glance) ? dev.at_a_glance.length : 0
            const hasAnalysis = glanceCount > 0 || Boolean(dev.delivery_record)
            return (
              <Link
                key={dev.id}
                href={`/admin/developers/${dev.slug}/edit`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {dev.logo_url ? (
                    <img src={dev.logo_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-gray-300">{dev.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#18181b] truncate">{dev.name}</p>
                  <p className="text-xs text-gray-400 truncate">/{dev.slug}</p>
                </div>
                <span className="text-xs text-gray-400 hidden sm:block">
                  {dev.projects?.length ?? 0} project{(dev.projects?.length ?? 0) === 1 ? '' : 's'}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    hasAnalysis ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {hasAnalysis ? 'Analysis' : 'Empty'}
                </span>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-[#18181b] transition-colors flex-shrink-0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
        </div>

      </div>
    </div>
  )
}
