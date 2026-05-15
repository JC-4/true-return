import { redis } from '@/lib/redis'
import Link from 'next/link'
import DealAnalysis, { type StoredDeal } from '@/app/(main)/deals/[id]/DealAnalysis'

export default async function PublicDealPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const deal = await redis.get<StoredDeal>(`deal:jc:${id}`)

  if (!deal) {
    return (
      <div className="bg-[#fafafa] min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Deal not found</h1>
          <p className="text-sm text-gray-500">This link may have expired or the deal doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  return <DealAnalysis deal={deal} isPublic />
}
