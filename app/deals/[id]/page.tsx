import { redirect, notFound } from 'next/navigation'
import { redis } from '@/lib/redis'
import Link from 'next/link'

type DealParams = {
  price?: number; rent?: number; growth?: number
  internalSqft?: number; balconySqft?: number
  view?: string; unit?: string; project?: string
  completion?: string; developer?: string
  serviceCharge?: number; dld?: number; agencyFee?: number; adminFee?: number
  propertyType?: string; handoverValue?: number
  paymentPlan?: string
}

function buildCalcUrl(p: DealParams): string {
  const q = new URLSearchParams()
  if (p.price)                              q.set('price',         String(p.price))
  if (p.rent)                               q.set('rent',          String(p.rent))
  if (p.growth !== undefined)               q.set('growth',        String(p.growth))
  if (p.internalSqft)                       q.set('internalSqft',  String(p.internalSqft))
  if (p.balconySqft)                        q.set('balconySqft',   String(p.balconySqft))
  if (p.project)                            q.set('project',       p.project)
  if (p.unit)                               q.set('unit',          p.unit)
  if (p.view)                               q.set('view',          p.view)
  if (p.completion)                         q.set('completion',    p.completion)
  if (p.developer)                          q.set('developer',     p.developer)
  if (p.serviceCharge)                      q.set('serviceCharge', String(p.serviceCharge))
  if (p.dld !== undefined && p.dld !== 4)   q.set('dld',           String(p.dld))
  if (p.agencyFee)                          q.set('agencyFee',     String(p.agencyFee))
  if (p.adminFee)                           q.set('adminFee',      String(p.adminFee))
  if (p.propertyType && p.propertyType !== 'offplan') q.set('propertyType', p.propertyType)
  if (p.handoverValue)                      q.set('handoverValue', String(p.handoverValue))
  if (p.paymentPlan && p.paymentPlan !== '[]') {
    q.set('paymentPlan', encodeURIComponent(p.paymentPlan))
  }
  return `/calculators/investment?${q.toString()}`
}

export default async function SharedDealPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await redis.get<DealParams>(`deal:${id}`)

  if (!data) {
    return (
      <div className="bg-[#F5F5F2] min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Deal not found</h1>
          <p className="text-sm text-gray-500 mb-6">This link may have expired or the deal was never saved.</p>
          <Link
            href="/calculators/investment"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1a2744] hover:bg-[#1e3a5f] transition-colors"
          >
            Open calculator
          </Link>
        </div>
      </div>
    )
  }

  redirect(buildCalcUrl(data))
}
