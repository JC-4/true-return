'use client'
import { useEffect, useRef } from 'react'

// Fires one view event per mount, from the client so link-preview crawlers
// (which don't run JS) are never counted. The ref guards strict mode's
// double-invoked effects; failures are ignored — analytics never breaks a page.
// `disabled` is decided server side (own visit — admin session or ?preview=1).
export default function ShortlistViewLogger({ token, event, entryId, disabled = false }: {
  token: string
  event: 'open' | 'expand' | 'conclusion'
  entryId?: string
  disabled?: boolean
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (disabled || fired.current) return
    fired.current = true
    fetch('/api/shortlist-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event, entryId }),
    }).catch(() => { /* ignore */ })
  }, [token, event, entryId, disabled])

  return null
}
