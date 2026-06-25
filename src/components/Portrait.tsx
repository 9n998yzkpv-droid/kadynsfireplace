'use client'
import { useEffect, useRef, useState } from 'react'

// Shows the user's photo from /kadyn.jpg. Until that file exists in public/,
// it falls back to a tasteful monogram so the page never shows a broken image.
// Drop a photo at public/kadyn.jpg and it appears automatically — no code change.
export default function Portrait() {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // The image's error event can fire before React hydrates and attaches onError
  // (especially on a 404 in dev). Catch that case on mount: if the image has
  // already finished loading with no dimensions, it failed.
  useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [])

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: '4 / 5',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src="/kadyn.jpg"
          alt="Kadyn Rawls"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <span className="font-serif-display text-5xl" style={{ color: 'var(--text-muted)' }}>
            KR
          </span>
          <span className="label" style={{ opacity: 0.7 }}>
            Add public/kadyn.jpg
          </span>
        </div>
      )}
    </div>
  )
}
