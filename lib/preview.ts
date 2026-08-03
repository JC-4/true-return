// Preserves ?preview=1 across internal shortlist links so view-log suppression
// survives moving between pages. Deliberately dependency-free: imported by both
// server pages and the client stepper.
export function withPreview(href: string, preview: boolean): string {
  return preview ? `${href}?preview=1` : href
}

export function isPreviewParam(v: string | string[] | undefined): boolean {
  return (Array.isArray(v) ? v[0] : v) === '1'
}
