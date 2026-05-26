'use client'
import { useState } from 'react'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const inputCls =
    'w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm text-[#18181b] placeholder-[#a1a1aa] focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-24 pb-20">
        <h1 className="text-3xl font-bold text-[#18181b] mb-10">Get in touch</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#e4e4e7] p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#71717a] uppercase tracking-wide mb-1.5">
              Message
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              required
              className={`${inputCls} resize-none`}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#18181b] hover:bg-[#27272a] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            Send message
          </button>
        </form>
      </div>
    </div>
  )
}
