'use client'
import { useState, useEffect } from 'react'

export default function GallerySlider({ images, onOpenLightbox }: { images: string[]; onOpenLightbox: (index: number) => void }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const toPreload = [
      images[(current + 1) % images.length],
      images[(current - 1 + images.length) % images.length],
    ]
    toPreload.forEach(src => {
      const img = new Image()
      img.src = src
    })
  }, [current, images])

  function prev() { setCurrent(i => (i - 1 + images.length) % images.length) }
  function next() { setCurrent(i => (i + 1) % images.length) }

  if (images.length === 0) return null

  return (
    <section id="gallery" className="py-16 border-t border-brand-border">
        <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-6">Gallery</p>
        <div className="relative rounded-2xl overflow-hidden" style={{ height: 'clamp(240px, 50vw, 600px)' }}>
          <img
            src={images[current]}
            alt=""
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => onOpenLightbox(current)}
          />

          {/* Bottom-right arrows */}
          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2">
              <button
                onClick={prev}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', color: '#ffffff', border: '0.5px solid rgba(255,255,255,0.25)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={next}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)', color: '#ffffff', border: '0.5px solid rgba(255,255,255,0.25)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Dot navigation */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: i === current ? 24 : 6,
                  height: 6,
                  borderRadius: 9999,
                  backgroundColor: i === current ? '#A0784A' : '#D4C5B0',
                  border: 'none',
                  padding: 0,
                  transition: 'width 0.3s ease, background-color 0.3s ease',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        )}
    </section>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

export function Lightbox({
  images,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  images: string[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white text-2xl leading-none"
        aria-label="Close"
      >
        ×
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/60 text-sm tabular-nums">
        {index + 1} / {images.length}
      </div>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Previous image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image — stopPropagation so clicking the image doesn't close */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
      />

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-white/70 hover:text-white"
          aria-label="Next image"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
