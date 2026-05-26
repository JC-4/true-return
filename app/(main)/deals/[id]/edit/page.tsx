import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { redis } from '@/lib/redis'
import DealBuilder from '../../new/DealBuilder'
import type { Metadata } from 'next'

type StoredDeal = { id: string; name: string; params: Record<string, unknown> }

export const metadata: Metadata = { title: 'Edit Deal — TrueReturn' }

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const userId = (session.user as { id?: string }).id!
  const { id } = await params
  const deal = await redis.get<StoredDeal>(`deal:${userId}:${id}`)
  if (!deal) redirect('/deals')

  const p = deal.params
  // Parse paymentPlan string back to PlanRow array
  let paymentPlan: Array<{ id: string; label: string; date: string; pct: number; handover?: boolean }> = []
  try { paymentPlan = JSON.parse((p.paymentPlan as string) ?? '[]') } catch { /* ignore */ }

  const initialValues = {
    dealId: id,
    dealName: deal.name,
    price:          p.price as number,
    rent:           p.rent as number,
    growth:         p.growth as number,
    handoverValue:  p.handoverValue as number | undefined,
    propertyType:   p.propertyType as 'offplan' | 'secondary' | undefined,
    propertySubType: p.propertySubType as 'apartment' | 'townhouse' | 'villa' | undefined,
    internalSqft:   p.internalSqft as number | undefined,
    balconySqft:    p.balconySqft as number | undefined,
    buaSqft:        p.buaSqft as number | undefined,
    plotSqft:       p.plotSqft as number | undefined,
    scRate:         p.serviceCharge as number | undefined,
    developer:      p.developer as string | undefined,
    developerId:    p.developerId as string | undefined,
    projectSlug:    p.projectSlug as string | undefined,
    project:        p.project as string | undefined,
    completion:     p.completion as string | undefined,
    unit:           p.unit as string | undefined,
    view:           p.view as string | undefined,
    emirate:        p.emirate as 'Dubai' | 'Abu Dhabi' | undefined,
    location:       p.location as string | undefined,
    dldPct:         p.dld as number | undefined,
    agencyFeePct:   p.agencyFee as number | undefined,
    adminFee:       p.adminFee as number | undefined,
    mortgageOn:     p.mortgageOn as boolean | undefined,
    depositPct:     p.depositPct as number | undefined,
    interestRate:   p.interestRate as number | undefined,
    termYears:      p.termYears as number | undefined,
    mortgageType:   p.mortgageType as 'repayment' | 'interest-only' | undefined,
    paymentPlan,
    bedrooms:       p.bedrooms !== undefined ? p.bedrooms as number | null : undefined,
    typology:       p.typology as string | null | undefined,
  }

  return <DealBuilder initialValues={initialValues} editingDealId={id} editingDealName={deal.name} />
}
