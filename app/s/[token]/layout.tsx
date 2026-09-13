import { getShortlist, deriveSteps } from '@/lib/shortlist'
import ShortlistStepper from '@/components/ShortlistStepper'

// Shortlist routes live outside the (main) route group so they don't inherit
// the site Nav: a client reading a report should have no way out of it.
//
// Both tiers stick as a single unit so they can never detach on scroll.
// z-40 keeps the header under the gallery lightbox (z-50).
export default async function ShortlistLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const shortlist = await getShortlist(token)
  const steps = shortlist ? deriveSteps(shortlist, token) : []

  return (
    <>
      <div className="sticky top-0 z-40">
        {/* Wordmark only — deliberately not a link. It stays because it is the
            only attribution that survives someone forwarding the link. */}
        <header className="bg-[#1C1B18] border-b border-[#2E2D2A]">
          <div className="max-w-6xl mx-auto px-5 sm:px-10">
            <div className="flex items-center h-11 sm:h-12">
              <span className="text-white font-semibold text-sm sm:text-base tracking-tight">Offplan Source</span>
            </div>
          </div>
        </header>

        <ShortlistStepper steps={steps} />
      </div>

      {children}
    </>
  )
}
