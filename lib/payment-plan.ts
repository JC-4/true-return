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
