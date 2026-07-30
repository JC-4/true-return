import type { UnitType } from '@/lib/types'

export type SliderBounds = { min: number; max: number; step: number }

// Step targets ~100 increments across the range, snapped to the nearest clean
// number; bounds are rounded to the step so every slider position lands on a
// round value.
export function sliderBounds(rawMin: number, rawMax: number, minStep: number): SliderBounds {
  const target = (rawMax - rawMin) / 100
  const steps = [1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000]
  const step = Math.max(minStep, steps.reduce((best, s) => Math.abs(s - target) < Math.abs(best - target) ? s : best))
  return { min: Math.round(rawMin / step) * step, max: Math.round(rawMax / step) * step, step }
}

// Bounds derive from the unit's stored estimate when there is one, putting
// the seeded value near mid-track with usable resolution either side. Units
// without an estimate fall back to price-derived bounds; absolute floors
// keep small units workable, and hard-coded bounds cover units with no price.
export function returnSliderBounds(
  unit: Pick<UnitType, 'expected_rent' | 'expected_handover_value'> | undefined,
  basePrice: number,
): { rent: SliderBounds; hv: SliderBounds } {
  const seededRent = unit?.expected_rent ?? 0
  const seededHV   = unit?.expected_handover_value ?? 0
  const rent = seededRent > 0
    ? sliderBounds(Math.max(10_000, seededRent * 0.6), seededRent * 1.6, 1_000)
    : basePrice > 0
      ? sliderBounds(Math.max(10_000, basePrice * 0.03), basePrice * 0.09, 1_000)
      : { min: 20_000, max: 300_000, step: 5_000 }
  const hv = seededHV > 0
    ? sliderBounds(Math.max(100_000, seededHV * 0.75), seededHV * 1.5, 10_000)
    : basePrice > 0
      ? sliderBounds(Math.max(100_000, basePrice * 0.85), basePrice * 1.6, 10_000)
      : { min: 300_000, max: 5_000_000, step: 50_000 }
  return { rent, hv }
}

export function snapToBounds(v: number, b: SliderBounds): number {
  return Math.min(b.max, Math.max(b.min, Math.round(v / b.step) * b.step))
}

// The values ReturnAnalysisPanel seeds its sliders with on first render.
// The shortlist comparison uses these same defaults when an entry has no
// stored assumptions, so its numbers agree with the panel at load.
export function defaultReturnInputs(
  unit: UnitType | undefined,
  basePrice: number,
): { rent: number; handoverValue: number; growth: number; holdPeriod: number } {
  const bounds = returnSliderBounds(unit, basePrice)
  return {
    rent:          snapToBounds(unit?.expected_rent           ?? basePrice * 0.07, bounds.rent),
    handoverValue: snapToBounds(unit?.expected_handover_value ?? basePrice * 1.2,  bounds.hv),
    growth: 5,
    holdPeriod: 5,
  }
}
