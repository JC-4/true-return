'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

const calculatorLinks = [
  { href: '/calculators/investment', label: 'Investment Calculator' },
  { href: '/calculators/mortgage',   label: 'Mortgage Calculator' },
]

const otherLinks = [
  { href: '/deals',        label: 'Deals' },
  { href: '/areas',        label: 'Areas' },
  { href: '/notes',        label: 'Notes' },
  { href: '/work-with-me', label: 'Work With Me' },
]

export default function Nav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const calcActive = pathname.startsWith('/calculators')

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-[#1a1a1a] font-semibold text-lg tracking-tight">
            TrueReturn
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">

            {/* Calculators dropdown */}
            <div ref={dropdownRef} className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center gap-1 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  calcActive
                    ? 'text-[#185FA5] bg-[#EEF4FB]'
                    : 'text-gray-700 hover:text-[#1a1a1a] hover:bg-gray-100'
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
                <div className="absolute top-full left-0 mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {calculatorLinks.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setDropdownOpen(false)}
                      className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                        pathname === href
                          ? 'text-[#185FA5] bg-[#EEF4FB]'
                          : 'text-gray-700 hover:text-[#185FA5] hover:bg-[#EEF4FB]'
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Other links */}
            {otherLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? 'text-[#1a1a1a] bg-gray-100'
                    : 'text-gray-700 hover:text-[#1a1a1a] hover:bg-gray-100'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-gray-600 hover:text-gray-900 p-2"
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
          <div className="sm:hidden border-t border-gray-200 py-2">
            <p className="px-4 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Calculators
            </p>
            {calculatorLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2 text-sm font-medium rounded ${
                  pathname === href
                    ? 'text-[#185FA5] bg-[#EEF4FB]'
                    : 'text-gray-700 hover:text-[#185FA5] hover:bg-[#EEF4FB]'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-gray-200 mt-1 pt-1">
              {otherLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-4 py-2 text-sm font-medium rounded ${
                    pathname.startsWith(href)
                      ? 'text-[#1a1a1a] bg-gray-100'
                      : 'text-gray-700 hover:text-[#1a1a1a] hover:bg-gray-100'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
