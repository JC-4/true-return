'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'

/** Admin-only edit affordance for otherwise static public pages.
 *  Reading the session on the server would opt the page out of ISR, so this
 *  resolves client-side instead — Nav already calls useSession on every page,
 *  so the session is in the provider cache and this costs no extra request.
 *  The link is chrome, not content: it appears once the session resolves. */
export default function AdminEditLink({
  resource,
  slug,
  label,
}: {
  resource: 'developers' | 'projects'
  slug: string
  label: string
}) {
  const { data: session } = useSession()
  const isAdmin = Boolean((session?.user as { isAdmin?: boolean } | undefined)?.isAdmin)

  if (!isAdmin) return null

  // Built here rather than passed in: props to a client component are serialised
  // into the RSC payload of a public page even when nothing renders, and there's
  // no reason to publish the admin URL. resource and slug are already public.
  return (
    <Link
      href={`/admin/${resource}/${slug}/edit`}
      className="flex items-center gap-1 text-xs text-brand-hint hover:text-brand-bronze transition-colors flex-shrink-0"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      {label}
    </Link>
  )
}
