'use client'
import { useState } from 'react'

// PLACEHOLDER: Change this password before deploying.
const ADMIN_PASSWORD = 'changeme'

function Field({
  label,
  name,
  value,
  type = 'text',
  placeholder,
  onChange,
}: {
  label: string
  name: string
  value: string
  type?: string
  placeholder?: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
      />
    </div>
  )
}

export default function AdminGeneratePage() {
  const [authed, setAuthed]     = useState(false)
  const [pw,     setPw]         = useState('')
  const [pwError, setPwError]   = useState(false)
  const [copied, setCopied]     = useState(false)

  // Form fields
  const [project,      setProject]      = useState('')
  const [unit,         setUnit]         = useState('')
  const [price,        setPrice]        = useState('')
  const [internalSqft, setInternalSqft] = useState('')
  const [balconySqft,  setBalconySqft]  = useState('')
  const [view,         setView]         = useState('')
  const [completion,   setCompletion]   = useState('')
  const [rent,         setRent]         = useState('')
  const [vacancy,      setVacancy]      = useState('2')

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true)
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  const buildUrl = () => {
    const base    = typeof window !== 'undefined' ? window.location.origin : ''
    const params  = new URLSearchParams()
    if (project)      params.set('project',      project)
    if (unit)         params.set('unit',          unit)
    if (price)        params.set('price',         price)
    if (internalSqft) params.set('internalSqft',  internalSqft)
    if (balconySqft)  params.set('balconySqft',   balconySqft)
    if (view)         params.set('view',          view)
    if (completion)   params.set('completion',    completion)
    if (rent)         params.set('rent',          rent)
    if (vacancy)      params.set('vacancy',       vacancy)
    return `${base}/calculator?${params.toString()}`
  }

  const generatedUrl = buildUrl()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!authed) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-[#27272a] text-xs font-semibold uppercase tracking-widest mb-2">Admin</p>
            <h1 className="text-2xl font-bold text-[#18181b]">Generate calculator link</h1>
          </div>
          <form onSubmit={handleLogin} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent"
                autoFocus
              />
              {pwError && (
                <p className="text-red-600 text-xs mt-1.5">Incorrect password.</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-[#18181b] hover:bg-[#27272a] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <p className="text-[#27272a] text-xs font-semibold uppercase tracking-widest mb-2">Admin · Private</p>
          <h1 className="text-2xl font-bold text-[#18181b] mb-1">Generate calculator link</h1>
          <p className="text-sm text-[#71717a]">
            Fill in property details and copy the pre-filled calculator URL to share with a client.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Property details</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Project name"     name="project"      value={project}      placeholder="e.g. At 85 Residences"   onChange={setProject} />
            <Field label="Unit number"      name="unit"         value={unit}         placeholder="e.g. 85R-308"            onChange={setUnit} />
            <Field label="Purchase price (AED)" name="price"   value={price}        type="number" placeholder="e.g. 2060000" onChange={setPrice} />
            <Field label="Predicted annual rent (AED)" name="rent" value={rent}    type="number" placeholder="e.g. 130000"  onChange={setRent} />
            <Field label="Internal sqft"    name="internalSqft" value={internalSqft} type="number" placeholder="e.g. 1243"  onChange={setInternalSqft} />
            <Field label="Balcony sqft"     name="balconySqft"  value={balconySqft}  type="number" placeholder="e.g. 405"   onChange={setBalconySqft} />
            <Field label="View type"        name="view"         value={view}         placeholder="e.g. Pool View"          onChange={setView} />
            <Field label="Completion date"  name="completion"   value={completion}   placeholder="e.g. Q2 2028"            onChange={setCompletion} />
            <Field label="Vacancy (weeks/yr)" name="vacancy"   value={vacancy}      type="number" placeholder="e.g. 2"     onChange={setVacancy} />
          </div>
        </div>

        {/* Generated URL */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Generated URL</p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
            <p className="text-xs font-mono text-gray-600 break-all leading-relaxed">{generatedUrl}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-[#18181b] hover:bg-[#27272a] text-white'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy URL
                </>
              )}
            </button>
            <a
              href={generatedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3"
            >
              Preview
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
