'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import type { Developer, DeliveredProject, GlanceRow } from '@/lib/types'

// ─── Shared input styles (mirrors the project editor) ────────────────────────

const inputCls =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

// ─── Field components ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={inputCls}
      />
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows: number
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`${inputCls} resize-y leading-relaxed`}
      />
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

/** Preview-with-replace image upload. Used for both the delivery record and
 *  performance images — same route, same compression. */
function ImageField({
  label,
  cta,
  value,
  uploading,
  onUpload,
  onClear,
  hint,
}: {
  label: string
  cta: string
  value: string
  uploading: boolean
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {value ? (
        <div className="space-y-2">
          <img src={value} alt={label} className="w-full max-w-lg rounded-lg border border-gray-200" />
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Remove image
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center h-28 max-w-lg rounded-lg border border-dashed border-gray-200 bg-gray-50 cursor-pointer text-sm text-gray-400 hover:border-gray-300 transition-colors">
          {uploading ? 'Uploading…' : cta}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onUpload(f)
            }}
          />
        </label>
      )}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function MoveButtons({
  index,
  total,
  onMove,
}: {
  index: number
  total: number
  onMove: (dir: 'up' | 'down') => void
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => onMove('up')}
        disabled={index === 0}
        aria-label="Move up"
        className="text-gray-300 hover:text-[#18181b] disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5L7 5l3.5 3.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onMove('down')}
        disabled={index === total - 1}
        aria-label="Move down"
        className="text-gray-300 hover:text-[#18181b] disabled:opacity-30 disabled:hover:text-gray-300 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 5.5L7 9l3.5-3.5" />
        </svg>
      </button>
    </div>
  )
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-gray-300 hover:text-red-500 transition-colors"
    >
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 3l8 8M11 3l-8 8" />
      </svg>
    </button>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#18181b] transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M7 1v12M1 7h12" />
      </svg>
      {children}
    </button>
  )
}

// ─── Editor ──────────────────────────────────────────────────────────────────

/** Delivered rows carry a local key so new (unsaved, id-less) rows keep React identity. */
type DeliveredRow = {
  key: string
  id: string | null
  name: string
  location: string
  year: string
  image_url: string | null
}

function normaliseGlance(raw: unknown): GlanceRow[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap(r => {
    if (!r || typeof r !== 'object') return []
    const { label, value } = r as Record<string, unknown>
    return [{ label: typeof label === 'string' ? label : '', value: value == null ? '' : String(value) }]
  })
}

export default function EditDeveloperClient({
  developer,
  initialDelivered,
}: {
  developer: Developer
  initialDelivered: DeliveredProject[]
}) {
  const router = useRouter()

  // Uploads and the save request address the developer by its persisted slug,
  // so editing the slug field mid-session can't misroute them.
  const persistedSlug = developer.slug

  const [name, setName] = useState(developer.name)
  const [slug, setSlug] = useState(developer.slug)
  const [logoUrl, setLogoUrl] = useState(developer.logo_url ?? '')
  const [description, setDescription] = useState(developer.description ?? '')
  const [tier, setTier] = useState(developer.tier?.toString() ?? '')

  const [glance, setGlance] = useState<GlanceRow[]>(normaliseGlance(developer.at_a_glance))
  const [deliveryRecord, setDeliveryRecord] = useState(developer.delivery_record ?? '')
  const [deliveryRecordImageUrl, setDeliveryRecordImageUrl] = useState(developer.delivery_record_image_url ?? '')
  const [performanceImageUrl, setPerformanceImageUrl] = useState(developer.performance_image_url ?? '')
  const [performanceNote, setPerformanceNote] = useState(developer.performance_note ?? '')
  const [reviewedAt, setReviewedAt] = useState(developer.reviewed_at ?? '')

  const keySeq = useRef(0)
  const nextKey = () => `row-${keySeq.current++}`

  const [delivered, setDelivered] = useState<DeliveredRow[]>(() =>
    initialDelivered.map(d => ({
      key: nextKey(),
      id: d.id,
      name: d.name,
      location: d.location ?? '',
      year: d.year?.toString() ?? '',
      image_url: d.image_url,
    }))
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  // ── Uploads ───────────────────────────────────────────────────────────────

  async function uploadImage(
    file: File,
    token: string,
    opts?: { maxSizeMB?: number; maxWidthOrHeight?: number }
  ): Promise<string | null> {
    if (!ACCEPTED.includes(file.type)) {
      setError('Images must be JPEG, PNG or WebP')
      return null
    }
    setError(null)
    setUploading(token)
    try {
      // Never pass `fileType`. browser-image-compression only white-fills the
      // canvas when the OUTPUT type matches /jpe?g/, and output defaults to the
      // input's type — so a transparent PNG logo stays a transparent PNG.
      // Forcing JPEG here would flatten every logo onto a white box.
      const compressed = await imageCompression(file, {
        maxSizeMB: opts?.maxSizeMB ?? 1,
        maxWidthOrHeight: opts?.maxWidthOrHeight ?? 1920,
        useWebWorker: true,
      })
      const form = new FormData()
      form.append('file', compressed, file.name)
      const res = await fetch(`/api/developers/${persistedSlug}/images`, { method: 'POST', body: form })
      const body = await res.json() as { publicUrl?: string; error?: string }
      if (!res.ok || !body.publicUrl) {
        setError(`Upload failed: ${body.error ?? res.status}`)
        return null
      }
      return body.publicUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      return null
    } finally {
      setUploading(null)
    }
  }

  // ── At a glance repeater ──────────────────────────────────────────────────

  function updateGlance(i: number, field: keyof GlanceRow, value: string) {
    setGlance(rows => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function moveGlance(i: number, dir: 'up' | 'down') {
    const to = dir === 'up' ? i - 1 : i + 1
    setGlance(rows => {
      if (to < 0 || to >= rows.length) return rows
      const next = [...rows]
      ;[next[i], next[to]] = [next[to], next[i]]
      return next
    })
  }

  // ── Delivered repeater ────────────────────────────────────────────────────

  function updateDelivered(i: number, field: 'name' | 'location' | 'year', value: string) {
    setDelivered(rows => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  function moveDelivered(i: number, dir: 'up' | 'down') {
    const to = dir === 'up' ? i - 1 : i + 1
    setDelivered(rows => {
      if (to < 0 || to >= rows.length) return rows
      const next = [...rows]
      ;[next[i], next[to]] = [next[to], next[i]]
      return next
    })
  }

  async function setDeliveredImage(i: number, file: File) {
    const url = await uploadImage(file, `delivered-${i}`)
    if (!url) return
    setDelivered(rows => rows.map((r, idx) => (idx === i ? { ...r, image_url: url } : r)))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)

    const developerPayload = {
      name: name.trim(),
      slug: slug.trim(),
      logo_url: logoUrl.trim() || null,
      description: description.trim() || null,
      tier: tier ? parseInt(tier, 10) : null,
      // Drop rows where both cells are blank rather than writing empty pairs.
      at_a_glance: glance
        .map(r => ({ label: r.label.trim(), value: r.value.trim() }))
        .filter(r => r.label || r.value),
      delivery_record: deliveryRecord.trim() || null,
      delivery_record_image_url: deliveryRecordImageUrl.trim() || null,
      performance_image_url: performanceImageUrl.trim() || null,
      performance_note: performanceNote.trim() || null,
      reviewed_at: reviewedAt || null,
    }

    const deliveredPayload = delivered
      .filter(d => d.name.trim())
      .map(d => ({
        id: d.id,
        name: d.name.trim(),
        location: d.location.trim() || null,
        year: d.year ? parseInt(d.year, 10) : null,
        image_url: d.image_url,
      }))

    try {
      const res = await fetch(`/api/developers/${persistedSlug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer: developerPayload, delivered: deliveredPayload }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

      if (developerPayload.slug !== persistedSlug) {
        router.replace(`/admin/developers/${developerPayload.slug}/edit`)
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[#27272a] text-xs font-semibold uppercase tracking-widest mb-2">
            Admin · Private
          </p>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#18181b] mb-1">Edit developer</h1>
              <p className="text-sm text-[#71717a]">{developer.name}</p>
            </div>
            <div className="flex items-center gap-4 mt-1 flex-shrink-0">
              {/* Points at the persisted slug, not the edited field — the public
                  page only exists at the slug that is actually saved. */}
              <Link
                href={`/developers/${persistedSlug}`}
                className="text-xs text-[#71717a] hover:text-[#18181b] underline underline-offset-2 whitespace-nowrap"
              >
                View developer page
              </Link>
              <Link
                href="/admin/developers"
                className="text-xs text-[#71717a] hover:text-[#18181b] underline underline-offset-2 whitespace-nowrap"
              >
                All developers
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-6">

          {/* ── Details ────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <SectionHeader label="Details" />

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" value={name} onChange={setName} placeholder="Developer name" />
              <Field
                label="Slug"
                value={slug}
                onChange={setSlug}
                placeholder="developer-name"
                hint="Changing this changes the public URL."
              />
            </div>

            <TextArea
              label="Description"
              value={description}
              onChange={setDescription}
              rows={3}
              placeholder="Short neutral summary…"
              hint="Shown in the developer page header, as the card blurb on /developers, and as the page meta description."
            />

            <div className="sm:max-w-[50%] sm:pr-2">
              <Field
                label="Tier"
                type="number"
                value={tier}
                onChange={setTier}
                placeholder="1"
                hint="Deal builder scoring. Never shown on a public page."
              />
            </div>

            {/* Logo ─ upload rather than a URL field. Logos are usually PNGs with
                transparent backgrounds, so the checkerboard makes a flattened
                white box obvious at a glance. */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Logo
              </label>
              <div className="flex items-center gap-4">
                <div
                  className="w-20 h-20 flex-shrink-0 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)',
                    backgroundSize: '12px 12px',
                    backgroundPosition: '0 0,0 6px,6px -6px,-6px 0',
                  }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400">None</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 items-start">
                  <label className="cursor-pointer text-sm text-gray-500 hover:text-[#18181b] underline underline-offset-2 transition-colors">
                    {uploading === 'logo'
                      ? 'Uploading…'
                      : logoUrl ? 'Replace logo' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async e => {
                        const f = e.target.files?.[0]
                        e.target.value = ''
                        if (!f) return
                        // Logos are small; no reason to allow a 1920px 1MB file.
                        const url = await uploadImage(f, 'logo', {
                          maxSizeMB: 0.3,
                          maxWidthOrHeight: 512,
                        })
                        if (url) setLogoUrl(url)
                      }}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Clear logo
                    </button>
                  )}
                  <p className="text-xs text-gray-400">
                    PNG transparency is preserved.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── At a glance ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <SectionHeader
              label="At a glance"
              hint="Rendered in order as a two-column table. Rows vary by developer — add whatever is useful."
            />

            {glance.length === 0 ? (
              <p className="text-sm text-gray-400">No rows yet.</p>
            ) : (
              <div className="space-y-2">
                {glance.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <MoveButtons index={i} total={glance.length} onMove={dir => moveGlance(i, dir)} />
                    <input
                      type="text"
                      value={row.label}
                      onChange={e => updateGlance(i, 'label', e.target.value)}
                      placeholder="Label"
                      className={`${inputCls} flex-[2]`}
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={e => updateGlance(i, 'value', e.target.value)}
                      placeholder="Value"
                      className={`${inputCls} flex-[3]`}
                    />
                    <RemoveButton
                      label={`Remove row ${i + 1}`}
                      onClick={() => setGlance(rows => rows.filter((_, idx) => idx !== i))}
                    />
                  </div>
                ))}
              </div>
            )}

            <AddButton onClick={() => setGlance(rows => [...rows, { label: '', value: '' }])}>
              Add row
            </AddButton>
          </div>

          {/* ── Delivery record ────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <SectionHeader label="Delivery record" />
            <TextArea
              label="Paragraph"
              value={deliveryRecord}
              onChange={setDeliveryRecord}
              rows={10}
              placeholder="Their track record on handovers, build quality, snagging…"
            />
            <ImageField
              label="Image"
              cta="Upload image"
              value={deliveryRecordImageUrl}
              uploading={uploading === 'delivery-record'}
              onClear={() => setDeliveryRecordImageUrl('')}
              onUpload={async f => {
                const url = await uploadImage(f, 'delivery-record')
                if (url) setDeliveryRecordImageUrl(url)
              }}
              hint="Optional. Sits to the right of the paragraph; without it the prose runs full width."
            />
          </div>

          {/* ── Delivered projects ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <SectionHeader
              label="Delivered projects"
              hint="Completed buildings with no project page of their own. The public page shows the first four; the rest are listed by name."
            />

            {delivered.length === 0 ? (
              <p className="text-sm text-gray-400">No delivered projects yet.</p>
            ) : (
              <div className="space-y-3">
                {delivered.map((row, i) => (
                  <div
                    key={row.key}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      i < 4 ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="pt-2">
                      <MoveButtons index={i} total={delivered.length} onMove={dir => moveDelivered(i, dir)} />
                    </div>

                    <label className="w-24 h-20 flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden cursor-pointer flex items-center justify-center relative">
                      {row.image_url ? (
                        <img src={row.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-gray-400 text-center px-1">
                          {uploading === `delivered-${i}` ? 'Uploading…' : 'Add image'}
                        </span>
                      )}
                      {row.image_url && uploading === `delivered-${i}` && (
                        <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] text-gray-600">
                          Uploading…
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) setDeliveredImage(i, f)
                          e.target.value = ''
                        }}
                      />
                    </label>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 w-4 flex-shrink-0">
                          {i + 1}
                        </span>
                        <input
                          type="text"
                          value={row.name}
                          onChange={e => updateDelivered(i, 'name', e.target.value)}
                          placeholder="Building name"
                          className={inputCls}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 pl-6">
                        <input
                          type="text"
                          value={row.location}
                          onChange={e => updateDelivered(i, 'location', e.target.value)}
                          placeholder="Location"
                          className={`${inputCls} col-span-2`}
                        />
                        <input
                          type="number"
                          value={row.year}
                          onChange={e => updateDelivered(i, 'year', e.target.value)}
                          placeholder="Year"
                          className={inputCls}
                        />
                      </div>
                      {row.image_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setDelivered(rows =>
                              rows.map((r, idx) => (idx === i ? { ...r, image_url: null } : r))
                            )
                          }
                          className="ml-6 text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >
                          Remove image
                        </button>
                      )}
                    </div>

                    <div className="pt-2">
                      <RemoveButton
                        label={`Remove ${row.name || `row ${i + 1}`}`}
                        onClick={() => setDelivered(rows => rows.filter((_, idx) => idx !== i))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {delivered.length > 4 && (
              <p className="mt-3 text-xs text-gray-400">
                Rows 5+ appear on the public page as a plain text list of names.
              </p>
            )}

            <AddButton
              onClick={() =>
                setDelivered(rows => [
                  ...rows,
                  { key: nextKey(), id: null, name: '', location: '', year: '', image_url: null },
                ])
              }
            >
              Add delivered project
            </AddButton>
          </div>

          {/* ── Performance ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <SectionHeader
              label="Performance"
              hint="Shown publicly only when both the image and the note are set."
            />

            <ImageField
              label="Chart image"
              cta="Upload chart image"
              value={performanceImageUrl}
              uploading={uploading === 'performance'}
              onClear={() => setPerformanceImageUrl('')}
              onUpload={async f => {
                const url = await uploadImage(f, 'performance')
                if (url) setPerformanceImageUrl(url)
              }}
              hint="Renders at about half the container width — roughly 600px."
            />

            <TextArea
              label="Note"
              value={performanceNote}
              onChange={setPerformanceNote}
              rows={7}
              placeholder="What the chart shows…"
            />
          </div>

          {/* ── Review ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <SectionHeader label="Review" />
            <div className="max-w-xs">
              <Field
                label="Reviewed at"
                type="date"
                value={reviewedAt}
                onChange={setReviewedAt}
                hint="Shown as “Reviewed {month year}”. Leave blank to hide."
              />
            </div>
          </div>

          {/* ── Save bar ───────────────────────────────────────────────────── */}
          <div
            className="sticky bottom-0 z-10 border-t border-gray-100 bg-white px-6 py-3 flex items-center justify-between gap-4"
            style={{ marginLeft: -24, marginRight: -24, paddingLeft: 24, paddingRight: 24 }}
          >
            <Link
              href={`/developers/${persistedSlug}`}
              className="text-xs text-[#71717a] hover:text-[#18181b] underline underline-offset-2 whitespace-nowrap"
            >
              ← View developer
            </Link>
            <div className="flex items-center gap-4">
              {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
              {error && <span className="text-sm text-red-500 max-w-xs truncate">{error}</span>}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploading !== null}
                className="bg-[#18181b] hover:bg-[#27272a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
