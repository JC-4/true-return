import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import { redis } from '@/lib/redis'
import type { Project, ProjectInsight } from '@/lib/types'
import type { PlanRow } from '@/lib/calculations'
import ProjectDetail from '../../ProjectDetail'

type Props = { params: Promise<{ slug: string; id: string }> }

async function getProject(slug: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, developer:developers(*), unit_types(*)')
    .eq('slug', slug)
    .single()
  if (error) { console.error('[insight-share slug]', error.message); return null }
  return data as Project
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  return {
    title: project ? `${project.name} — Insight — TrueReturn` : 'Insight — TrueReturn',
    robots: { index: false, follow: false },
  }
}

export default async function InsightSharePage({ params }: Props) {
  const { slug, id } = await params

  const [project, insight, snapshot] = await Promise.all([
    getProject(slug),
    redis.get<ProjectInsight>(`insight:${slug}`),
    redis.get<{ params: Record<string, unknown> }>(`insight-share:${slug}:${id}`),
  ])

  if (!project || !snapshot) notFound()

  // Map stored params back to InitialValues (same pattern as edit/page.tsx)
  const p = snapshot.params
  let paymentPlan: PlanRow[] = []
  try { paymentPlan = JSON.parse((p.paymentPlan as string) ?? '[]') } catch { /* ignore */ }

  const snapshotValues = {
    price:           p.price          as number | undefined,
    rent:            p.rent           as number | undefined,
    growth:          p.growth         as number | undefined,
    handoverValue:   p.handoverValue  as number | undefined,
    propertyType:    p.propertyType   as 'offplan' | 'secondary' | undefined,
    propertySubType: p.propertySubType as 'apartment' | 'townhouse' | 'villa' | undefined,
    internalSqft:    p.internalSqft   as number | undefined,
    balconySqft:     p.balconySqft    as number | undefined,
    buaSqft:         p.buaSqft        as number | undefined,
    plotSqft:        p.plotSqft       as number | undefined,
    scRate:          p.serviceCharge  as number | undefined,
    developer:       p.developer      as string | undefined,
    developerId:     p.developerId    as string | undefined,
    projectSlug:     p.projectSlug    as string | undefined,
    project:         p.project        as string | undefined,
    completion:      p.completion     as string | undefined,
    unit:            p.unit           as string | undefined,
    view:            p.view           as string | undefined,
    emirate:         p.emirate        as 'Dubai' | 'Abu Dhabi' | undefined,
    location:        p.location       as string | undefined,
    dldPct:          p.dld            as number | undefined,
    agencyFeePct:    p.agencyFee      as number | undefined,
    adminFee:        p.adminFee       as number | undefined,
    mortgageOn:      p.mortgageOn     as boolean | undefined,
    depositPct:      p.depositPct     as number | undefined,
    interestRate:    p.interestRate   as number | undefined,
    termYears:       p.termYears      as number | undefined,
    mortgageType:    p.mortgageType   as 'repayment' | 'interest-only' | undefined,
    paymentPlan,
    bedrooms:        p.bedrooms !== undefined ? p.bedrooms as number | null : undefined,
    typology:        p.typology       as string | null | undefined,
  }

  return (
    <ProjectDetail
      project={project}
      insight={insight ?? {}}
      snapshotValues={snapshotValues}
    />
  )
}
