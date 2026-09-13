import { revalidatePath } from 'next/cache'

/**
 * Drops the cached copies of the public pages that render a project, so an
 * admin save shows up straight away.
 *
 * This is on top of, not instead of, `revalidate = 60` on those routes. The
 * time-based baseline still covers everything that changes outside the editor
 * — a direct Supabase edit, say — and this only removes the wait when we know
 * a change just happened.
 *
 * The slug is not editable in the admin form, so the path we invalidate is
 * always the path that existed before the save.
 */
export function revalidateProject(slug: string) {
  revalidatePath(`/projects/${slug}`)
  revalidatePath('/projects')
}
