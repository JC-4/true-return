'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import CompareTable, { buildCompareEntry, type CompareEntry, type StoredDeal, type ComparisonSnapshot } from './CompareTable'

// ── Inner component (uses useSearchParams) ────────────────────────────────────

function ComparePageInner() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)

  const [entries, setEntries]     = useState<CompareEntry[]>([])
  const [rawDeals, setRawDeals]   = useState<StoredDeal[]>([])
  const [loaded, setLoaded]       = useState(false)
  const [shareUrl, setShareUrl]   = useState<string | null>(null)
  const [sharing, setSharing]     = useState(false)

  useEffect(() => {
    if (ids.length === 0) { setLoaded(true); return }
    Promise.all(ids.map(id => fetch(`/api/user/deals/${id}`).then(r => r.json())))
      .then((deals: StoredDeal[]) => {
        const valid = deals.filter(d => d && d.id)
        setRawDeals(valid)
        setEntries(valid.map(buildCompareEntry))
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()])

  async function handleShare() {
    if (rawDeals.length < 2) return
    setSharing(true)
    try {
      const body: ComparisonSnapshot = { type: 'comparison', deals: rawDeals }
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const { id } = await res.json()
      const url = `${window.location.origin}/compare/${id}`
      setShareUrl(url)
      await navigator.clipboard.writeText(url).catch(() => {})
    } finally {
      setSharing(false)
    }
  }

  if (!loaded) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading comparison…</p>
      </div>
    )
  }

  if (ids.length < 2 || entries.length < 2) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-4">Select at least 2 deals to compare.</p>
          <Link href="/deals" className="text-sm font-semibold text-[#10b981] hover:underline">
            ← Back to deals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#fafafa] min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Deal Comparison</h1>
            <p className="text-sm text-gray-500">Comparing {entries.length} deals side by side</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/deals"
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Deals
            </Link>
            {shareUrl ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#10b981] font-semibold">Link copied!</span>
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => {})}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors truncate max-w-[180px]"
                  title={shareUrl}
                >
                  Copy again
                </button>
              </div>
            ) : (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#18181b] text-white hover:bg-[#27272a] transition-colors disabled:opacity-50"
              >
                {sharing ? 'Sharing…' : '↗ Share'}
              </button>
            )}
          </div>
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

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  )
}
