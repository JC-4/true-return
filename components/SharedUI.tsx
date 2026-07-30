'use client'
import { useState, useEffect, useRef } from 'react'

// ─── Secondary pill nav ───────────────────────────────────────────────────────

export function SecondaryPillNav({ sections }: { sections: { id: string; label: string; locked?: boolean; color?: string }[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const containerRef = useRef<HTMLDivElement>(null)
  const pillRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [slider, setSlider] = useState({ left: 0, width: 0 })

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
      setSlider({ left: btnRect.left - containerRect.left, width: btnRect.width })
    }
  }, [activeId, sections])

  function handleClick(id: string) {
    setActiveId(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (sections.length === 0) return null

  return (
    <div
      className="fixed z-50"
      style={{ bottom: '24px', left: '50%', transform: 'translateX(-50%)' }}
    >
      <div
        ref={containerRef}
        className="relative inline-flex items-center bg-white p-1"
        style={{ borderRadius: '9999px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      >
        <div
          className="absolute top-1 bottom-1"
          style={{
            backgroundColor: '#1C1B18',
            borderRadius: '9999px',
            left: slider.left,
            width: slider.width,
            transition: 'left 0.4s cubic-bezier(0.4, 0.2, 0.2, 1), width 0.4s cubic-bezier(0.4, 0.2, 0.2, 1)',
          }}
        />
        {sections.map(({ id, label, locked, color }) => (
          <button
            key={id}
            ref={el => { if (el) pillRefs.current.set(id, el); else pillRefs.current.delete(id) }}
            onClick={() => handleClick(id)}
            className="relative z-10 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap border-0 bg-transparent transition-colors inline-flex items-center gap-1.5"
            style={{ color: activeId === id ? '#fff' : (color ?? '#8e8e8e') }}
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
        style={{ backgroundColor: '#F4F3F0', borderColor: '#E5E3DC', color: '#9B9589' }}
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
            backgroundColor: '#1C1B18',
            color: 'rgba(255,255,255,0.8)',
            pointerEvents: 'none',
          }}
        >
          {text}
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: '#1C1B18' }}
          />
        </div>
      )}
    </div>
  )
}
