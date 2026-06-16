'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import imageCompression from 'browser-image-compression'
import type { Project, PaymentSegment } from '@/lib/types'

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls =
  'w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#18181b] focus:border-transparent'

const readonlyCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 cursor-default select-none'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const formatted = Number(intPart).toLocaleString('en-US')
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted
}

function stripCommas(v: string): string {
  return v.replace(/,/g, '').replace(/[^\d.]/g, '')
}

// ─── Field components ─────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  readOnly,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  readOnly?: boolean
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
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        className={readOnly ? readonlyCls : inputCls}
      />
    </div>
  )
}

// Money field: stores raw numeric string, displays with thousand separators
function MoneyField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (raw: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type="text"
        inputMode="numeric"
        value={formatMoney(value)}
        placeholder={placeholder}
        onChange={e => onChange(stripCommas(e.target.value))}
        className={inputCls}
      />
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">{label}</p>
  )
}

// ─── Slab date picker ─────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 16 }, (_, i) => THIS_YEAR + i)

function isoToMMYYYY(iso: string | null): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length < 2) return ''
  return `${parts[1].padStart(2, '0')}/${parts[0]}`
}

type DateMode = 'on-booking' | 'handover' | 'month-year'

function parseDateValue(
  date: string,
  handoverMMYYYY: string
): { mode: DateMode; month: string; year: string } {
  if (date === 'On booking') return { mode: 'on-booking', month: '', year: '' }
  if ((handoverMMYYYY && date === handoverMMYYYY) || date === 'Handover')
    return { mode: 'handover', month: '', year: '' }
  const mmyyyy = date.match(/^(\d{1,2})\/(\d{4})$/)
  if (mmyyyy) return { mode: 'month-year', month: mmyyyy[1].padStart(2, '0'), year: mmyyyy[2] }
  const bareYear = date.match(/^(\d{4})$/)
  if (bareYear) return { mode: 'month-year', month: '01', year: bareYear[1] }
  const mmOnly = date.match(/^(\d{1,2})\/$/)
  if (mmOnly) return { mode: 'month-year', month: mmOnly[1].padStart(2, '0'), year: '' }
  const yyyyOnly = date.match(/^\/(\d{4})$/)
  if (yyyyOnly) return { mode: 'month-year', month: '', year: yyyyOnly[1] }
  return { mode: 'month-year', month: '', year: '' }
}

// ─── Image section ───────────────────────────────────────────────────────────

type UploadStatus = {
  filename: string
  fileNum: number
  total: number
  phase: 'compressing' | 'uploading'
  pct: number
}

function ImageSection({ slug, initialImages }: { slug: string; initialImages: string[] }) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [status, setStatus] = useState<UploadStatus | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function persistImages(updated: string[]) {
    const res = await fetch(`/api/projects/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project: { images: updated }, unit_types: [] }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string }
      console.error('[ImageSection] persistImages failed:', body.error ?? res.status)
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const accepted = Array.from(files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    )
    if (!accepted.length) return

    setUploadError(null)
    const newImages = [...images]

    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i]

      setStatus({ filename: file.name, fileNum: i + 1, total: accepted.length, phase: 'compressing', pct: 0 })
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        onProgress: pct => setStatus(s => s ? { ...s, pct } : s),
      })

      setStatus(s => s ? { ...s, phase: 'uploading', pct: 0 } : s)

      const form = new FormData()
      form.append('file', compressed, file.name)

      const res = await fetch(`/api/projects/${slug}/images`, { method: 'POST', body: form })
      const body = await res.json() as { publicUrl?: string; error?: string }

      if (!res.ok || !body.publicUrl) {
        console.error('[ImageSection] Upload failed for', file.name, '—', body.error ?? res.status)
        setUploadError(`Upload failed: ${body.error ?? 'unknown error'}`)
        continue
      }

      console.log('[ImageSection] Uploaded', file.name, '→', body.publicUrl)
      newImages.push(body.publicUrl)
      setImages([...newImages])
      await persistImages([...newImages])
    }

    setStatus(null)
  }

  async function deleteImage(url: string, index: number) {
    const pathMatch = url.match(/\/project-images\/(.+?)(?:\?|$)/)
    if (pathMatch) {
      const res = await fetch(`/api/projects/${slug}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: decodeURIComponent(pathMatch[1]) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        console.error('[ImageSection] Delete failed:', body.error ?? res.status)
      }
    }
    const updated = images.filter((_, i) => i !== index)
    setImages(updated)
    await persistImages(updated)
  }

  async function move(index: number, dir: 'up' | 'down') {
    const to = dir === 'up' ? index - 1 : index + 1
    if (to < 0 || to >= images.length) return
    const updated = [...images]
    ;[updated[index], updated[to]] = [updated[to], updated[index]]
    setImages(updated)
    await persistImages(updated)
  }

  const uploading = status !== null

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <SectionHeader label="Images" />

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {images.map((url, i) => (
            <div key={url} className="relative group aspect-video rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-[#18181b] text-white px-1.5 py-0.5 rounded">
                  Hero
                </span>
              )}
              <button
                type="button"
                onClick={() => void deleteImage(url, i)}
                className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-red-500 text-white rounded text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete image"
              >
                ×
              </button>
              <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => void move(i, 'up')}
                  className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white rounded text-xs"
                  title="Move up"
                >↑</button>
                <button
                  type="button"
                  disabled={i === images.length - 1}
                  onClick={() => void move(i, 'down')}
                  className="w-6 h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white rounded text-xs"
                  title="Move down"
                >↓</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files) }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          uploading
            ? 'border-gray-200 opacity-70 cursor-default'
            : dragOver
            ? 'border-[#18181b] bg-gray-50 cursor-pointer'
            : 'border-gray-200 hover:border-gray-300 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={e => { void handleFiles(e.target.files ?? []); e.target.value = '' }}
        />
        {uploading && status ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              {status.phase === 'compressing' ? 'Compressing' : 'Uploading'}{' '}
              <span className="font-medium text-[#18181b]">{status.filename}</span>
              {status.total > 1 && <span className="text-gray-400"> ({status.fileNum} of {status.total})</span>}
            </p>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-xs mx-auto">
              {status.phase === 'compressing' ? (
                <div
                  className="h-full bg-[#18181b] rounded-full transition-all duration-100"
                  style={{ width: `${status.pct}%` }}
                />
              ) : (
                <div className="h-full bg-[#18181b] rounded-full animate-pulse" style={{ width: '40%' }} />
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500">
              Drop images here or{' '}
              <span className="text-[#18181b] font-medium">click to browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · Compressed to max 1 MB</p>
          </>
        )}
      </div>
      {uploadError && (
        <p className="mt-3 text-xs text-red-500">{uploadError}</p>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

const SEGMENT_COLORS: PaymentSegment['color'][] = ['bronze', 'bronze-mid', 'bronze-light']

type EditSegment = {
  label: string
  percent: string
  date: string
  color: PaymentSegment['color']
}

type EditPlan = {
  name: string
  segments: EditSegment[]
}

type EditUnitType = {
  id: string
  type: string
  bedrooms: number | null
  price_from: string
  internal_sqft: string
  balcony_sqft: string
  expected_rent: string
  expected_handover_value: string
}

// ─── Live calculations ────────────────────────────────────────────────────────

type YieldCalc = { serviceCharge: number; netYield: number | null }

function calcYield(ut: EditUnitType, scRate: string): YieldCalc | null {
  const price = parseFloat(ut.price_from)
  const internal = parseInt(ut.internal_sqft)
  const rate = parseFloat(scRate)
  if (!price || !internal || !rate) return null

  const balcony = parseInt(ut.balcony_sqft) || 0
  const serviceCharge = internal * rate + balcony * rate * 0.25

  const rent = parseFloat(ut.expected_rent)
  const netYield = rent ? ((rent - serviceCharge) / price) * 100 : null

  return { serviceCharge, netYield }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditProjectClient({ project }: { project: Project }) {
  // Project-level fields
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [status, setStatus] = useState(project.status ?? '')
  const [handoverDate, setHandoverDate] = useState(project.handover_date ?? '')
  const [startingPrice, setStartingPrice] = useState(project.starting_price?.toString() ?? '')
  const [community, setCommunity] = useState(project.community ?? '')
  const [location, setLocation] = useState(project.location ?? '')
  const [serviceChargeRate, setServiceChargeRate] = useState(
    project.service_charge_rate?.toString() ?? ''
  )
  const [paymentPlanConfirmed, setPaymentPlanConfirmed] = useState(
    project.payment_plan_confirmed ?? false
  )

  // Payment plans (all of them)
  const [plans, setPlans] = useState<EditPlan[]>(
    (project.payment_plans ?? []).map(plan => ({
      name: plan.name,
      segments: plan.segments.map(s => ({
        label: s.label,
        percent: s.percent.toString(),
        date: s.date ?? '',
        color: s.color,
      })),
    }))
  )

  // Unit types
  const [unitTypes, setUnitTypes] = useState<EditUnitType[]>(
    (project.unit_types ?? []).map(ut => ({
      id: ut.id,
      type: ut.type,
      bedrooms: ut.bedrooms,
      price_from: ut.price_from?.toString() ?? '',
      internal_sqft: ut.internal_sqft?.toString() ?? '',
      balcony_sqft: ut.balcony_sqft?.toString() ?? '',
      expected_rent: ut.expected_rent?.toString() ?? '',
      expected_handover_value: ut.expected_handover_value?.toString() ?? '',
    }))
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Payment plan helpers ───────────────────────────────────────────────────

  function updateSegment<K extends keyof EditSegment>(planIdx: number, segIdx: number, key: K, value: EditSegment[K]) {
    setPlans(prev => prev.map((plan, pi) =>
      pi !== planIdx ? plan : {
        ...plan,
        segments: plan.segments.map((s, si) => si === segIdx ? { ...s, [key]: value } : s),
      }
    ))
  }

  function addSegment(planIdx: number) {
    setPlans(prev => prev.map((plan, pi) =>
      pi !== planIdx ? plan : {
        ...plan,
        segments: [...plan.segments, { label: '', percent: '', date: '', color: SEGMENT_COLORS[plan.segments.length % 3] }],
      }
    ))
  }

  function removeSegment(planIdx: number, segIdx: number) {
    setPlans(prev => prev.map((plan, pi) =>
      pi !== planIdx ? plan : {
        ...plan,
        segments: plan.segments.filter((_, si) => si !== segIdx),
      }
    ))
  }

  function updatePlanName(planIdx: number, name: string) {
    setPlans(prev => prev.map((plan, pi) => pi === planIdx ? { ...plan, name } : plan))
  }

  function addPlan() {
    setPlans(prev => [
      ...prev,
      { name: '', segments: [{ label: '', percent: '', date: '', color: SEGMENT_COLORS[0] }] },
    ])
  }

  function removePlan(planIdx: number) {
    setPlans(prev => prev.filter((_, pi) => pi !== planIdx))
  }

  // ── Unit type helpers ──────────────────────────────────────────────────────

  function updateUnitType<K extends keyof EditUnitType>(index: number, key: K, value: EditUnitType[K]) {
    setUnitTypes(prev => prev.map((ut, i) => (i === index ? { ...ut, [key]: value } : ut)))
  }

  function calcPricePerSqft(ut: EditUnitType): string {
    const price = parseFloat(ut.price_from)
    const internal = parseInt(ut.internal_sqft)
    const balcony = parseInt(ut.balcony_sqft) || 0
    const total = internal + balcony
    if (!price || !total) return '—'
    return `AED ${Math.round(price / total).toLocaleString()}`
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setError(null)

    const updatedPlans = plans.map(plan => ({
      name: plan.name,
      segments: plan.segments.map(s => ({
        label: s.label,
        percent: parseFloat(s.percent) || 0,
        date: s.date,
        color: s.color,
      })),
    }))

    const projectPayload = {
      name: name.trim(),
      description: description.trim() || null,
      status: status || null,
      handover_date: handoverDate || null,
      starting_price: startingPrice ? parseFloat(startingPrice) : null,
      community: community.trim() || null,
      location: location.trim() || null,
      service_charge_rate: serviceChargeRate ? parseFloat(serviceChargeRate) : null,
      payment_plan_confirmed: paymentPlanConfirmed,
      payment_plans: updatedPlans,
    }

    const unitTypesPayload = unitTypes.map(ut => ({
      id: ut.id,
      price_from: ut.price_from ? parseFloat(ut.price_from) : null,
      internal_sqft: ut.internal_sqft ? parseInt(ut.internal_sqft) : null,
      balcony_sqft: ut.balcony_sqft ? parseInt(ut.balcony_sqft) : 0,
      expected_rent: ut.expected_rent ? parseFloat(ut.expected_rent) : null,
      expected_handover_value: ut.expected_handover_value ? parseFloat(ut.expected_handover_value) : null,
    }))

    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: projectPayload, unit_types: unitTypesPayload }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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
              <h1 className="text-2xl font-bold text-[#18181b] mb-1">Edit project</h1>
              <p className="text-sm text-[#71717a]">{project.name}</p>
            </div>
            <Link
              href={`/projects/${project.slug}`}
              className="text-xs text-[#71717a] hover:text-[#18181b] underline underline-offset-2 whitespace-nowrap mt-1"
            >
              ← View project
            </Link>
          </div>
        </div>

        <div className="space-y-6">

          {/* ── Project details ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
            <SectionHeader label="Project details" />

            <Field label="Name" value={name} onChange={setName} placeholder="Project name" />

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Project description…"
                className={`${inputCls} resize-y`}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Status
                </label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— select —</option>
                  <option value="off_plan">Off plan</option>
                  <option value="under_construction">Under construction</option>
                  <option value="ready">Ready</option>
                </select>
              </div>
              <Field
                label="Handover date"
                type="date"
                value={handoverDate}
                onChange={setHandoverDate}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <MoneyField
                label="Starting price (AED)"
                value={startingPrice}
                onChange={setStartingPrice}
                placeholder="e.g. 1,500,000"
              />
              <Field
                label="Service charge rate (AED/sqft/yr)"
                type="number"
                value={serviceChargeRate}
                onChange={setServiceChargeRate}
                placeholder="e.g. 18"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Community" value={community} onChange={setCommunity} placeholder="e.g. Dubai Creek Harbour" />
              <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Dubai, UAE" />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="pp-confirmed"
                type="checkbox"
                checked={paymentPlanConfirmed}
                onChange={e => setPaymentPlanConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#18181b] focus:ring-[#18181b] cursor-pointer"
              />
              <label htmlFor="pp-confirmed" className="text-sm text-gray-700 cursor-pointer select-none">
                Payment plan confirmed
              </label>
            </div>
          </div>

          {/* ── Images ───────────────────────────────────────────────────── */}
          <ImageSection slug={project.slug} initialImages={project.images ?? []} />

          {/* ── Payment plan options ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Payment plan options</p>
              <p className="text-xs text-gray-400 mt-1">Clients will see these as alternatives to choose from.</p>
            </div>

            {plans.map((plan, pi) => {
              const totalPct = plan.segments.reduce((sum, s) => sum + (parseFloat(s.percent) || 0), 0)
              const pctOk = Math.abs(totalPct - 100) < 0.01
              return (
                <div key={pi} className="bg-white rounded-xl border border-gray-100 p-6">

                  {/* Plan name + remove */}
                  <div className="flex items-center gap-3 mb-5">
                    <input
                      type="text"
                      value={plan.name}
                      onChange={e => updatePlanName(pi, e.target.value)}
                      placeholder={`Plan name (e.g. Standard — 50/50)`}
                      className={`${inputCls} flex-1`}
                    />
                    {plans.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlan(pi)}
                        className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors whitespace-nowrap"
                      >
                        Remove plan
                      </button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-5">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-gray-400">Total allocated</span>
                      <span className={`text-xs font-semibold ${pctOk ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {totalPct.toFixed(totalPct % 1 === 0 ? 0 : 1)}%
                        {!pctOk && plan.segments.length > 0 && ' — must equal 100%'}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pctOk ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(totalPct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Segment rows */}
                  <div className="space-y-2">
                    {plan.segments.length === 0 && (
                      <p className="text-sm text-gray-400 py-2">No segments yet — add one below.</p>
                    )}
                    {plan.segments.map((seg, si) => {
                      const hmmy = isoToMMYYYY(handoverDate)
                      const now = new Date()
                      const todayM = String(now.getMonth() + 1).padStart(2, '0')
                      const todayY = String(now.getFullYear())
                      const { mode, month, year } = parseDateValue(seg.date, hmmy)
                      const [hM = '', hY = ''] = hmmy ? hmmy.split('/') : []
                      const dispMonth = mode === 'on-booking' ? todayM : mode === 'handover' ? hM : month
                      const dispYear  = mode === 'on-booking' ? todayY  : mode === 'handover' ? hY  : year
                      const locked = mode !== 'month-year'

                      function handleMode(newMode: DateMode) {
                        if (newMode === 'on-booking') updateSegment(pi, si, 'date', 'On booking')
                        else if (newMode === 'handover') updateSegment(pi, si, 'date', hmmy || 'Handover')
                        else updateSegment(pi, si, 'date', `${dispMonth}/${dispYear}`)
                      }

                      return (
                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            value={seg.label}
                            onChange={e => updateSegment(pi, si, 'label', e.target.value)}
                            placeholder="Label (e.g. Booking)"
                            style={{ width: 240, flexShrink: 0 }}
                            className={inputCls}
                          />
                          <input
                            type="number"
                            value={seg.percent}
                            onChange={e => updateSegment(pi, si, 'percent', e.target.value)}
                            placeholder="0"
                            style={{ width: 60, flexShrink: 0 }}
                            className={inputCls}
                          />
                          <span style={{ width: 16, flexShrink: 0, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>%</span>
                          <select
                            value={mode}
                            onChange={e => handleMode(e.target.value as DateMode)}
                            style={{ width: 160, flexShrink: 0 }}
                            className={inputCls}
                          >
                            <option value="on-booking">On booking</option>
                            <option value="handover">Handover</option>
                            <option value="month-year">Month / year</option>
                          </select>
                          <select
                            value={dispMonth}
                            disabled={locked}
                            onChange={e => updateSegment(pi, si, 'date', `${e.target.value}/${dispYear}`)}
                            style={{ width: 130, flexShrink: 0, opacity: locked ? 0.45 : 1 }}
                            className={inputCls}
                          >
                            <option value="">— month —</option>
                            {MONTHS.map((lbl, idx) => (
                              <option key={lbl} value={String(idx + 1).padStart(2, '0')}>{lbl}</option>
                            ))}
                          </select>
                          <select
                            value={dispYear}
                            disabled={locked}
                            onChange={e => updateSegment(pi, si, 'date', `${dispMonth}/${e.target.value}`)}
                            style={{ width: 100, flexShrink: 0, opacity: locked ? 0.45 : 1 }}
                            className={inputCls}
                          >
                            <option value="">— year —</option>
                            {YEARS.map(y => (
                              <option key={y} value={String(y)}>{y}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeSegment(pi, si)}
                            style={{ width: 32, height: 32, flexShrink: 0 }}
                            className="flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                            title="Remove row"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => addSegment(pi)}
                    className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#18181b] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add row
                  </button>
                </div>
              )
            })}

            {/* Add payment plan */}
            <button
              type="button"
              onClick={addPlan}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#18181b] transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add payment plan
            </button>
          </div>

          {/* ── Unit types ───────────────────────────────────────────────── */}
          {unitTypes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <SectionHeader label="Unit types" />
              <div className="space-y-6">
                {unitTypes.map((ut, i) => {
                  const ppsq = calcPricePerSqft(ut)
                  const yieldCalc = calcYield(ut, serviceChargeRate)
                  const bedroomLabel =
                    ut.bedrooms === null
                      ? 'Commercial'
                      : ut.bedrooms === 0
                      ? 'Studio'
                      : `${ut.bedrooms} BR`
                  return (
                    <div key={ut.id} className="border border-gray-100 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[#18181b]">{ut.type}</p>
                        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{bedroomLabel}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <MoneyField
                          label="Price from (AED)"
                          value={ut.price_from}
                          onChange={v => updateUnitType(i, 'price_from', v)}
                          placeholder="e.g. 1,200,000"
                        />
                        <Field
                          label="Internal sqft"
                          type="number"
                          value={ut.internal_sqft}
                          onChange={v => updateUnitType(i, 'internal_sqft', v)}
                          placeholder="e.g. 750"
                        />
                        <Field
                          label="Balcony sqft"
                          type="number"
                          value={ut.balcony_sqft}
                          onChange={v => updateUnitType(i, 'balcony_sqft', v)}
                          placeholder="0"
                        />
                        <Field
                          label="Price per sqft"
                          value={ppsq}
                          readOnly
                        />
                        {/* Expected rent + live calculations */}
                        <div className="col-span-2 sm:col-span-1 space-y-1.5">
                          <MoneyField
                            label="Expected annual rent (AED)"
                            value={ut.expected_rent}
                            onChange={v => updateUnitType(i, 'expected_rent', v)}
                            placeholder="e.g. 80,000"
                          />
                          {yieldCalc && (
                            <p className="text-xs text-gray-400">
                              Est. service charge: AED {Math.round(yieldCalc.serviceCharge).toLocaleString()}
                              {yieldCalc.netYield !== null && (
                                <>
                                  {' · '}
                                  <span className={yieldCalc.netYield >= 0 ? 'text-emerald-600' : 'text-red-400'}>
                                    Net yield: {yieldCalc.netYield.toFixed(1)}%
                                  </span>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <MoneyField
                            label="Expected handover value (AED)"
                            value={ut.expected_handover_value}
                            onChange={v => updateUnitType(i, 'expected_handover_value', v)}
                            placeholder="e.g. 1,500,000"
                          />
                          {(() => {
                            const hv = parseFloat(ut.expected_handover_value)
                            const pf = parseFloat(ut.price_from)
                            if (!hv || !pf) return null
                            const capApp = ((hv - pf) / pf) * 100
                            const positive = capApp >= 0
                            return (
                              <p className="text-xs text-gray-400">
                                Capital appreciation:{' '}
                                <span className={positive ? 'text-emerald-600' : 'text-red-400'}>
                                  {positive ? '+' : ''}{capApp.toFixed(1)}%
                                </span>
                              </p>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Save ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#18181b] hover:bg-[#27272a] text-white text-sm font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="text-sm text-emerald-600 font-medium">Saved successfully</span>
            )}
            {error && (
              <span className="text-sm text-red-500">{error}</span>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
