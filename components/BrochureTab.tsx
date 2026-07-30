'use client'
import { useState, useEffect } from 'react'

export type BrochureDoc = {
  name: string
  sizeBytes: number
  mimeType: string
  signedUrl: string | null
  signError: string | null
}

function fmtSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileLabel(name: string): { display: string; ext: string } {
  const parts = name.split('.')
  const ext = parts.length > 1 ? parts.pop()!.toUpperCase() : 'FILE'
  // Replace hyphens/underscores with spaces and title-case for display
  const display = parts.join('.').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return { display, ext }
}

export default function BrochureTab({ slug }: { slug: string }) {
  const [docs, setDocs] = useState<BrochureDoc[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/projects/${slug}/documents`)
      .then(r => r.json() as Promise<BrochureDoc[] | { error: string }>)
      .then(data => {
        if ('error' in data) { setError(data.error); return }
        setDocs(data)
      })
      .catch(() => setError('Failed to load documents.'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-brand-bronze border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (!docs || docs.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-center">
        <svg className="w-10 h-10 text-brand-hint/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm text-brand-hint">No documents uploaded for this project yet.</p>
      </div>
    )
  }

  return (
    <div className="py-10">
      <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-6">Documents</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {docs.map(doc => {
          const { display, ext } = fileLabel(doc.name)
          const isPdf = doc.mimeType === 'application/pdf' || ext === 'PDF'
          return (
            <div key={doc.name} className="bg-white border border-brand-border rounded-xl p-5 flex flex-col gap-4">
              {/* Icon + name */}
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
                  style={{ backgroundColor: isPdf ? '#A0784A' : '#6B7280' }}
                >
                  {ext}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-text leading-snug truncate" title={display}>{display}</p>
                  <p className="text-xs text-brand-hint mt-0.5">{fmtSize(doc.sizeBytes)}</p>
                </div>
              </div>

              {/* Open button */}
              {doc.signedUrl ? (
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-2 border border-brand-border text-brand-text text-xs font-medium px-4 py-2 rounded-lg hover:bg-brand-surface transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open
                </a>
              ) : (
                <p className="mt-auto text-xs text-red-400">
                  {doc.signError ?? 'Unable to generate link'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
