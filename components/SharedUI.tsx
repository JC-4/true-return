'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Secondary pill nav ───────────────────────────────────────────────────────

/** The slider's untransformed width. Arbitrary: scaleX is measured against it,
 *  so it only has to be non-zero and stable. */
const SLIDER_BASE_WIDTH = 100

export function SecondaryPillNav({ sections, desktopOnly = false, revealed = true }: {
  sections: { id: string; label: string; locked?: boolean; color?: string }[]
  /** Hide below md. Opt-in per call site: /projects/[slug] suppresses it on a
   *  phone, everywhere else keeps it. Defaults to showing at every width. */
  desktopOnly?: boolean
  /** Hold the nav back without unmounting it. No call site passes this today —
   *  /projects/[slug] briefly gated on scroll position and no longer does — but
   *  it stays because unmounting is the wrong way to hide this: the section
   *  observer below has to keep running so the correct pill is already active
   *  when it reappears. Defaults to shown. */
  revealed?: boolean
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  /* The slider is a fixed-width box moved and stretched with transform only.
   * `left` and `width` are layout properties: animating them registers a
   * layout shift on every frame even though the element is absolutely
   * positioned and moves nothing else. transform is exempt from that
   * accounting, so this produces none. */
  const [slider, setSlider] = useState({ x: 0, scaleX: 0, radiusX: 0, radiusY: 0 })

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-140px 0px -65% 0px', threshold: 0 }
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [sections])

  useEffect(() => {
    const btn = pillRefs.current.get(activeId)
    const container = containerRef.current
    if (btn && container) {
      const containerRect = container.getBoundingClientRect()
      const btnRect = btn.getBoundingClientRect()
      const halfHeight = btnRect.height / 2
      const scaleX = btnRect.width / SLIDER_BASE_WIDTH
      setSlider({
        // clientLeft is the container's left border. An absolutely positioned
        // child resolves against the padding box, so measuring from the border
        // box would sit the slider a border-width to the right of its pill.
        x: btnRect.left - (containerRect.left + container.clientLeft),
        scaleX,
        // scaleX would squash the capsule's end caps into ellipses. Dividing
        // the horizontal radius by the same factor cancels that out, so the
        // ends stay circular at every pill width.
        radiusX: scaleX > 0 ? halfHeight / scaleX : halfHeight,
        radiusY: halfHeight,
      })
    }
  }, [activeId, sections])

  // Publish the height this nav actually renders at, so anything reserving
  // room for it (the project hero's bottom padding) tracks the real thing
  // rather than a number copied from it. Skipped while the nav is display:none
  // below md, where the measurement would be 0 and nothing is reserving.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const publish = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) {
        document.documentElement.style.setProperty('--pill-nav-height', `${h}px`)
      }
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    window.addEventListener('resize', publish)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', publish)
    }
  }, [])

  function handleClick(id: string) {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (sections.length === 0) return null

  return (
    <div
      className={`${desktopOnly ? 'hidden md:block ' : ''}fixed z-50 transition-opacity duration-300`}
      style={{
        bottom: 'var(--pill-nav-offset)',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: revealed ? 1 : 0,
        // visibility, not just opacity: keeps it out of the tab order and the
        // accessibility tree while it is held back.
        visibility: revealed ? 'visible' : 'hidden',
        pointerEvents: revealed ? undefined : 'none',
      }}
    >
      <div
        ref={containerRef}
        /* The surface is opaque, so the pill renders identically over the dark
           hero and the light page body — nothing about it changes mid-scroll.
           The border is what defines its edge over the body, where the surface
           and the page are the same --paper; over the hero the scrim does that
           on its own. */
        className="relative inline-flex items-center bg-brand-raise border border-brand-border p-1"
        style={{ borderRadius: '9999px', boxShadow: '0 8px 24px rgb(var(--ink-rgb) / 0.16)' }}
      >
        <div
          className="absolute top-1 bottom-1 left-0"
          style={{
            backgroundColor: 'var(--c-accent)',
            width: SLIDER_BASE_WIDTH,
            borderRadius: `${slider.radiusX}px / ${slider.radiusY}px`,
            transformOrigin: 'left center',
            transform: `translateX(${slider.x}px) scaleX(${slider.scaleX})`,
            transition: 'transform 0.4s cubic-bezier(0.4, 0.2, 0.2, 1), border-radius 0.4s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}
        />
        {sections.map(({ id, label, locked, color }) => (
          <button
            key={id}
            ref={el => { if (el) pillRefs.current.set(id, el); else pillRefs.current.delete(id) }}
            onClick={() => handleClick(id)}
            className="relative z-10 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap border-0 bg-transparent transition-colors inline-flex items-center gap-1.5"
            /* --c-muted, not --c-hint: these are 12px interactive labels and
               hint only reaches 3.3:1 on --paper, short of AA. */
            style={{ color: activeId === id ? 'var(--c-on-accent)' : (color ?? 'var(--c-muted)') }}
          >
            {locked && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function outside(e: MouseEvent | TouchEvent) {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('touchstart', outside)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('touchstart', outside)
    }
  }, [open])

  function openTip() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.top, left: r.left + r.width / 2 })
    }
    setOpen(true)
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={openTip}
        onMouseLeave={() => setOpen(false)}
        onClick={() => { if (open) setOpen(false); else openTip() }}
        className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 leading-none border"
        style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-hint)' }}
        aria-label="More info"
      >
        ?
      </button>
      {open && (
        <div
          ref={tipRef}
          className="w-52 text-xs rounded-lg px-3 py-2.5 shadow-xl leading-relaxed"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, calc(-100% - 8px))',
            zIndex: 9999,
            backgroundColor: 'var(--c-inverse)',
            color: 'var(--c-on-inverse)',
            pointerEvents: 'none',
          }}
        >
          {text}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: 'var(--c-inverse)' }}
          />
        </div>
      )}
    </div>
  )
}
