'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Suspense } from 'react'

function LoginFormInner() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid username or password.')
    } else {
      // Full page reload so the new session cookie is picked up by middleware/server components
      window.location.href = '/crm'
    }
  }

  return (
    <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-[#18181b] font-semibold text-lg tracking-tight">
            TrueReturn
          </Link>
          <p className="text-[#71717a] text-sm mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e4e4e7] p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              className="w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-red-600 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#18181b] hover:bg-[#27272a] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-[#71717a] mt-4">
          Don&apos;t have access?{' '}
          <Link href="/apply" className="text-[#18181b] font-medium hover:underline">
            Apply for access
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  )
}
