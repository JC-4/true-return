'use client'
import { useState } from 'react'
import GallerySlider, { Lightbox } from '@/components/GallerySlider'

// Client wrapper pairing GallerySlider with its Lightbox so server components
// (the shortlist project page) can render a gallery without owning the state.
export default function ProjectGallery({ images }: { images: string[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  return (
    <>
      <GallerySlider images={images} onOpenLightbox={setLightboxIndex} />
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => i !== null ? (i - 1 + images.length) % images.length : null)}
          onNext={() => setLightboxIndex(i => i !== null ? (i + 1) % images.length : null)}
        />
      )}
    </>
  )
}
