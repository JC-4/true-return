'use client'
import { useEffect, useRef } from 'react'

// Fires one view event per mount, from the client so link-preview crawlers
// (which don't run JS) are never counted. The ref guards strict mode's
// double-invoked effects; failures are ignored — analytics never breaks a page.
export default function ShortlistViewLogger({ token, event, entryId }: {
  token: string
  event: 'open' | 'expand'
  entryId?: string
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fetch('/api/shortlist-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event, entryId }),
    }).catch(() => { /* ignore */ })
  }, [token, event, entryId])

  return null
}
