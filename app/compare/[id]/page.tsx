import { redis } from '@/lib/redis'
import Link from 'next/link'
import CompareTable, { buildCompareEntry, type ComparisonSnapshot } from '../CompareTable'

export default async function CompareSnapshotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const data = await redis.get<ComparisonSnapshot>(`deal:${id}`)

  if (!data || data.type !== 'comparison' || !Array.isArray(data.deals) || data.deals.length < 2) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Comparison not found</h1>
          <p className="text-sm text-gray-500 mb-6">This link may have expired or been deleted.</p>
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#18181b] hover:bg-[#27272a] transition-colors"
          >
            View saved deals
          </Link>
        </div>
      </div>
    )
  }

  const entries = data.deals.map(buildCompareEntry)

  return (
    <div className="bg-[#fafafa] min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Deal Comparison</h1>
            <p className="text-sm text-gray-500">Comparing {entries.length} deals side by side</p>
          </div>
          <Link
            href="/deals"
            className="flex-shrink-0 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Deals
          </Link>
        </div>
      </div>

      {/* Mobile fallback */}
      <div className="md:hidden max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-600 mb-5">
            This comparison is best viewed on a larger screen.
          </p>
          <div className="flex flex-col gap-2">
            {entries.map(e => (
              <Link
                key={e.id}
                href={`/deals/${e.id}`}
                className="block px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
              >
                {e.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block max-w-[1400px] mx-auto px-4 sm:px-6 pt-8">
        <CompareTable entries={entries} />
      </div>
    </div>
  )
}
