import type { UnitType } from '@/lib/types'

/**
 * The unit the public project page's unit/payment section opens on:
 * the flagged featured unit, otherwise the cheapest residential unit.
 *
 * This deliberately differs from ReturnAnalysisPanel, which falls back to the
 * median by price. That section is a shop window and should open on the entry
 * price; the panel is analysis and opens on the median so the numbers aren't
 * anchored on the cheapest unit in the building. Please don't "fix" the
 * divergence — it is the point.
 */
export function pickShowcaseUnit(unitTypes: UnitType[]): UnitType | undefined {
  if (unitTypes.length === 0) return undefined
  const featured = unitTypes.filter(ut => ut.is_featured)
  const residential = unitTypes.filter(ut => ut.bedrooms !== null)
  const pool = featured.length > 0 ? featured : (residential.length > 0 ? residential : unitTypes)
  return [...pool].sort((a, b) => (a.price_from ?? 0) - (b.price_from ?? 0))[0]
}
