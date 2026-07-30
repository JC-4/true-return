// Shortlist routes live outside the (main) route group so they don't inherit
// the site Nav: a client reading a report should have no way out of it.
// Wordmark only — deliberately not a link, no navigation.
export default function ShortlistLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="bg-[#1C1B18] border-b border-[#2E2D2A]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-16">
            <span className="text-white font-semibold text-lg tracking-tight">TrueReturn</span>
          </div>
        </div>
      </header>
      {children}
    </>
  )
}
