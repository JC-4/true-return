export default function NotesPage() {
  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-12">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Market commentary</p>
          {/* PLACEHOLDER: Update section heading */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Notes</h1>
          {/* PLACEHOLDER: Update description */}
          <p className="text-gray-600 text-base max-w-xl">
            Occasional analysis on Dubai&apos;s property market — pricing trends, interesting deals, and things worth knowing.
          </p>
        </div>

        {/* Empty state */}
        <div className="border border-gray-200 rounded-xl p-16 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-700 font-medium mb-1">No notes yet</p>
          {/* PLACEHOLDER: Update empty state message */}
          <p className="text-gray-500 text-sm">First post coming soon.</p>
        </div>
      </div>
    </div>
  )
}
