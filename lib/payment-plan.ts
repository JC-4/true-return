import type { Project } from '@/lib/types'
import type { PlanRow } from '@/lib/calculations'

export function formatHandoverDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function adaptPaymentPlan(plans: Project['payment_plans'], handoverDate: string | null): PlanRow[] {
  const plan = plans?.[0]
  if (!plan?.segments?.length) return []
  const handoverFormatted = formatHandoverDate(handoverDate)
  return plan.segments.map((seg, i) => {
    const isHandover = /hand|deliver|complet/i.test(seg.label) || (!!seg.date && seg.date === handoverFormatted)
    const isBooking = /book|sign|reserv|now/i.test(seg.label) || /^on booking$/i.test(seg.date ?? '')
    let date: string
    if (isBooking) {
      date = 'On booking'
    } else if (isHandover) {
      date = handoverFormatted ?? 'On handover'
    } else if (seg.date) {
      date = /^\d{4}$/.test(seg.date) ? `01/${seg.date}` : seg.date
    } else {
      date = 'During construction'
    }
    return { id: `seg-${i}`, label: seg.label, date, pct: seg.percent, ...(isHandover ? { handover: true } : {}) }
  })
}

export type PlanSegType = 'downpayment' | 'construction' | 'handover' | 'post-handover'

export function classifyPlanSeg(label: string): PlanSegType {
  const l = label.toLowerCase()
  if (l.includes('post') || (l.includes('after') && l.includes('handover'))) return 'post-handover'
  if (l.includes('handover')) return 'handover'
  if (l.includes('booking') || l.includes('down') || l.includes('reservation')) return 'downpayment'
  return 'construction'
}

// Short "60/40"-style split of the first payment plan, or null when no plan.
// Post-handover plans read pre/post handover; otherwise pre-handover/handover.
export function paymentPlanSummary(plans: Project['payment_plans']): string | null {
  const segs = plans?.[0]?.segments
  if (!segs?.length) return null
  const hasPost = segs.some(s => classifyPlanSeg(s.label) === 'post-handover')
  if (hasPost) {
    const y = segs.filter(s => classifyPlanSeg(s.label) === 'post-handover').reduce((sum, s) => sum + s.percent, 0)
    const x = 100 - y
    return `${Math.round(x)}/${Math.round(y)}`
  }
  const y = segs.filter(s => classifyPlanSeg(s.label) === 'handover').reduce((sum, s) => sum + s.percent, 0)
  const x = segs.filter(s => classifyPlanSeg(s.label) !== 'handover').reduce((sum, s) => sum + s.percent, 0)
  return `${Math.round(x)}/${Math.round(y)}`
}
