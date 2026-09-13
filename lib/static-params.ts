/** Guard for the `generateStaticParams` failure mode that exits 0.
 *
 *  Next does not treat an empty param list as an error: the route simply
 *  prerenders nothing, falls back to on-demand rendering, and the build
 *  succeeds. Every page that should have been in the route cache quietly
 *  isn't, and the first visitor pays for it — on every request until the
 *  next deploy, because `revalidate` does not re-run generateStaticParams.
 *
 *  This has already happened once: a transient ECONNRESET to Supabase during
 *  `next build` hit the `if (error) return []` path and shipped a build with
 *  no prerendered slugs, exit code 0, no warning.
 *
 *  So during a production build both an error and an empty list throw. In dev
 *  an empty list is normal (an empty table, a local database) and only logs. */
export function requireStaticParams<T>(
  route: string,
  rows: T[] | null,
  error: { message: string } | null,
): T[] {
  // generateStaticParams only runs at build time, so in practice this is
  // "are we in `next build`" rather than "are we serving production".
  const isBuild = process.env.NODE_ENV === 'production'

  if (error) {
    if (isBuild) {
      throw new Error(
        `[${route}] generateStaticParams failed: ${error.message}. ` +
        `Refusing to build a route with no prerendered params — see lib/static-params.ts.`
      )
    }
    console.error(`[${route}] generateStaticParams failed:`, error.message)
    return []
  }

  const params = rows ?? []

  if (params.length === 0 && isBuild) {
    throw new Error(
      `[${route}] generateStaticParams returned no params. ` +
      `That silently drops every prerendered page, so the build is failed deliberately. ` +
      `If the table really is empty, this route has nothing to serve anyway.`
    )
  }

  return params
}
