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
  { href: '/crm',   label: 'CRM' },
]

function NavLink({ href, label, pathname, onClick }: { href: string; label: string; pathname: string; onClick?: () => void }) {
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
        active ? 'text-[#18181b] bg-[#e4e4e7]' : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
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

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const calcActive = pathname.startsWith('/calculators')

  return (
    <nav className="bg-white border-b border-[#e4e4e7] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-[#18181b] font-semibold text-lg tracking-tight">
            TrueReturn
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
                        ? 'text-[#18181b] bg-[#e4e4e7]'
                        : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
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
                    <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-[#e4e4e7] py-1 z-50">
                      {calculatorLinks.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setDropdownOpen(false)}
                          className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                            pathname === href
                              ? 'text-[#18181b] bg-[#e4e4e7]'
                              : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
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
                  className="ml-2 px-3 py-2 rounded text-sm font-medium text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7] transition-colors"
                >
                  Sign out
                </button>
              </>
            )}

            {!isAdmin && (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                className="ml-2 px-3 py-2 text-sm text-[#a1a1aa] hover:text-[#71717a] transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-[#71717a] hover:text-[#18181b] p-2"
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
          <div className="sm:hidden border-t border-[#e4e4e7] py-2 space-y-0.5">
            {publicLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2 text-sm font-medium rounded ${
                  pathname.startsWith(href)
                    ? 'text-[#18181b] bg-[#e4e4e7]'
                    : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
                }`}
              >
                {label}
              </Link>
            ))}

            {isAdmin && (
              <div className="border-t border-[#e4e4e7] pt-2 mt-1 space-y-0.5">
                <p className="px-4 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#a1a1aa]">
                  Calculators
                </p>
                {calculatorLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-4 py-2 text-sm font-medium rounded ${
                      pathname === href
                        ? 'text-[#18181b] bg-[#e4e4e7]'
                        : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
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
                        ? 'text-[#18181b] bg-[#e4e4e7]'
                        : 'text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7]'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
                <button
                  onClick={() => { setMobileOpen(false); signOut({ callbackUrl: '/', redirect: true }) }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-[#71717a] hover:text-[#18181b] hover:bg-[#e4e4e7] rounded"
                >
                  Sign out
                </button>
              </div>
            )}

            {!isAdmin && (
              <div className="border-t border-[#e4e4e7] mt-1 pt-2">
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(pathname)}`}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2 text-sm text-[#a1a1aa] hover:text-[#71717a] rounded"
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
