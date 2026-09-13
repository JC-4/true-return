'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'

const calculatorLinks = [
  { href: '/calculators/investment', label: 'Investment Calculator' },
  { href: '/calculators/mortgage',   label: 'Mortgage Calculator' },
]

const publicLinks = [
  { href: '/projects', label: 'Projects' },
  { href: '/contact',  label: 'Contact' },
]

const adminLinks = [
  { href: '/deals', label: 'Deals' },
  { href: '/areas', label: 'Areas' },
  { href: '/notes', label: 'Notes' },
]

function NavLink({ href, label, pathname, onClick }: { href: string; label: string; pathname: string; onClick?: () => void }) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
        active ? 'text-brand-on-inverse bg-brand-inverse-raise' : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
      }`}
    >
      {label}
    </Link>
  )
}

export default function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const { data: session } = useSession()
  const isAdmin = !!session?.user

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Publish the sticky bar's height so the project hero can size itself to the
  // viewport less the nav, instead of both restating the number. Measures the
  // bar row plus the nav's border, not the <nav> element: the <nav> grows when
  // the mobile menu expands, and the hero wants the height of the fixed bar.
  useEffect(() => {
    const publish = () => {
      const bar = barRef.current
      const nav = navRef.current
      if (!bar || !nav) return
      const h = bar.getBoundingClientRect().height +
        parseFloat(getComputedStyle(nav).borderBottomWidth || '0')
      if (h > 0) document.documentElement.style.setProperty('--site-nav-height', `${h}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    if (barRef.current) ro.observe(barRef.current)
    window.addEventListener('resize', publish)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', publish)
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const calcActive = pathname.startsWith('/calculators')

  return (
    <nav ref={navRef} className="theme-os bg-brand-inverse border-b border-brand-inverse-line sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div ref={barRef} className="flex items-center justify-between h-16">
          <Link href="/" className="text-brand-on-inverse font-semibold text-lg tracking-tight">
            Offplan Source
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">
            {publicLinks.map(({ href, label }) => (
              <NavLink key={href} href={href} label={label} pathname={pathname} />
            ))}

            {/* Admin-only: Calculators dropdown + extra links */}
            {isAdmin && (
              <>
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={() => setDropdownOpen(v => !v)}
                    className={`flex items-center gap-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
                      calcActive
                        ? 'text-brand-on-inverse bg-brand-inverse-raise'
                        : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
                    }`}
                  >
                    Calculators
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-52 bg-brand-inverse rounded-lg shadow-lg border border-brand-inverse-line py-1 z-50">
                      {calculatorLinks.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDropdownOpen(false)}
                          className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                            pathname === href
                              ? 'text-brand-on-inverse bg-brand-inverse-raise'
                              : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {adminLinks.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} pathname={pathname} />
                ))}

                <button
                  onClick={() => signOut({ callbackUrl: '/', redirect: true })}
                  className="ml-2 px-3 py-2 rounded text-sm font-medium text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise transition-colors"
                >
                  Sign out
                </button>
              </>
            )}

            {!isAdmin && (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                className="ml-2 px-3 py-2 text-sm text-brand-on-inverse-muted hover:text-brand-on-inverse transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-brand-on-inverse-muted hover:text-brand-on-inverse p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-brand-inverse-line py-2 space-y-0.5">
            {publicLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2 text-sm font-medium rounded ${
                  pathname.startsWith(href)
                    ? 'text-brand-on-inverse bg-brand-inverse-raise'
                    : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
                }`}
              >
                {label}
              </Link>
            ))}

            {isAdmin && (
              <div className="border-t border-brand-inverse-line pt-2 mt-1 space-y-0.5">
                <p className="px-4 pb-1 text-xs font-medium text-brand-on-inverse-hint">
                  Calculators
                </p>
                {calculatorLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium rounded ${
                      pathname === href
                        ? 'text-brand-on-inverse bg-brand-inverse-raise'
                        : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                {adminLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium rounded ${
                      pathname.startsWith(href)
                        ? 'text-brand-on-inverse bg-brand-inverse-raise'
                        : 'text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/', redirect: true }) }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-brand-on-inverse-muted hover:text-brand-on-inverse hover:bg-brand-inverse-raise rounded"
                >
                  Sign out
                </button>
              </div>
            )}

            {!isAdmin && (
              <div className="border-t border-brand-inverse-line mt-1 pt-2">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2 text-sm text-brand-on-inverse-muted hover:text-brand-on-inverse rounded"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
