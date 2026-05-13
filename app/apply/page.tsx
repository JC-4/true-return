'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ApplyPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, reason }),
    })

    setLoading(false)

    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
    }
  }

  if (submitted) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-xl border border-[#e4e4e7] p-8">
            <div className="w-10 h-10 bg-[#10b981]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#18181b] mb-2">Application submitted</h2>
            <p className="text-sm text-[#71717a]">
              Your request has been received. You&apos;ll be notified once access is granted.
            </p>
            <Link
              href="/login"
              className="inline-block mt-6 text-sm text-[#18181b] font-medium hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-[#18181b] font-semibold text-lg tracking-tight">
            TrueReturn
          </Link>
          <p className="text-[#71717a] text-sm mt-2">Request access</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e4e4e7] p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Desired username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              className="w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Why do you need access?
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent resize-none"
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
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </form>

        <p className="text-center text-xs text-[#71717a] mt-4">
          Already have access?{' '}
          <Link href="/login" className="text-[#18181b] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
