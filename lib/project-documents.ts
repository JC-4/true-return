import { createServiceClient } from '@/lib/supabase'
import type { BrochureDoc } from '@/components/BrochureTab'

const BUCKET = 'project-documents'
const SIGNED_URL_TTL = 3600 // 1 hour

// Lists a project's documents: the externally hosted brochure (when
// projects.brochure_url is set) first, then uploaded files with signed URLs.
// Callers are responsible for authorisation (admin session on /api/projects,
// shortlist token on /api/shortlists).
export async function listProjectDocuments(slug: string): Promise<BrochureDoc[]> {
  const supabase = createServiceClient()

  const [{ data: project }, { data: files, error }] = await Promise.all([
    supabase.from('projects').select('brochure_url').eq('slug', slug).single(),
    supabase.storage
      .from(BUCKET)
      .list(slug, { limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  ])
  if (error) throw new Error(error.message)

  const docs: BrochureDoc[] = []
  const brochureUrl = (project as { brochure_url?: string | null } | null)?.brochure_url
  if (brochureUrl) {
    // Synthetic entry linking straight to the external URL — no file size, no
    // storage path, so sizeBytes is null and signedUrl carries the direct link
    docs.push({
      name: 'Project brochure',
      sizeBytes: null,
      mimeType: /\.pdf([?#]|$)/i.test(brochureUrl) ? 'application/pdf' : 'application/octet-stream',
      signedUrl: brochureUrl,
      signError: null,
    })
  }

  // Filter out placeholder/empty entries (Supabase lists folders as entries with no metadata)
  const realFiles = (files ?? []).filter(f => f.id !== null && f.name !== '.emptyFolderPlaceholder')
  if (realFiles.length === 0) return docs

  const uploaded = await Promise.all(
    realFiles.map(async file => {
      const path = `${slug}/${file.name}`
      const { data: signed, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL)

      const sizeBytes: number = (file.metadata as { size?: number } | null)?.size ?? 0
      const mimeType: string = (file.metadata as { mimetype?: string } | null)?.mimetype ?? 'application/octet-stream'

      return {
        name: file.name,
        sizeBytes,
        mimeType,
        signedUrl: signed?.signedUrl ?? null,
        signError: signErr?.message ?? null,
      }
    })
  )

  return [...docs, ...uploaded]
}
