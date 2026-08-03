import type { UnitType, ShortlistAssumptions } from '@/lib/types'

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

// Bounds sit around the seeded value, putting it near mid-track with usable
// resolution either side. With no seed they fall back to price-derived bounds;
// absolute floors keep small units workable, and hard-coded bounds cover the
// no-price case. Taking the seed as a plain number (rather than the unit) lets
// bounds be recomputed as rent scales with purchase price.
export function rentBoundsFor(seedRent: number, price: number): SliderBounds {
  return seedRent > 0
    ? sliderBounds(Math.max(10_000, seedRent * 0.6), seedRent * 1.6, 1_000)
    : price > 0
      ? sliderBounds(Math.max(10_000, price * 0.03), price * 0.09, 1_000)
      : { min: 20_000, max: 300_000, step: 5_000 }
}

export function hvBoundsFor(seedHV: number, price: number): SliderBounds {
  return seedHV > 0
    ? sliderBounds(Math.max(100_000, seedHV * 0.75), seedHV * 1.5, 10_000)
    : price > 0
      ? sliderBounds(Math.max(100_000, price * 0.85), price * 1.6, 10_000)
      : { min: 300_000, max: 5_000_000, step: 50_000 }
}

/**
 * The price to analyse: the entry's purchase price when set, otherwise the
 * unit's price_from. price_from is the cheapest unit in a building and usually
 * a poor one, so a shortlist entry can name the price actually worth modelling.
 */
export function effectivePrice(
  purchasePrice: number | null | undefined,
  unitPriceFrom: number | null | undefined,
): number {
  return purchasePrice ?? unitPriceFrom ?? 0
}

// Minimum is the unit's price_from exactly — nothing below it exists, and
// leaving it unrounded keeps the loaded value selectable and identical to the
// figure the comparison table uses. Maximum is 125% of the price at load.
export function priceSliderBounds(unitPriceFrom: number, price: number): SliderBounds {
  const min = unitPriceFrom > 0 ? unitPriceFrom : price
  const rawMax = Math.max(price * 1.25, min * 1.25)
  const { step } = sliderBounds(min, rawMax, 10_000)
  return { min, max: Math.max(Math.round(rawMax / step) * step, min + step), step }
}

export function snapToBounds(v: number, b: SliderBounds): number {
  return Math.min(b.max, Math.max(b.min, Math.round(v / b.step) * b.step))
}

export type ResolvedReturnInputs = {
  price: number
  rent: number
  handoverValue: number
  growth: number
  holdPeriod: number
  rentBounds: SliderBounds
  hvBounds: SliderBounds
  priceBounds: SliderBounds
}

/**
 * The single derivation of what the panel loads with, shared with the
 * shortlist comparison so the two cannot disagree.
 *
 * Rent and handover value are seeded from the entry's assumptions where
 * present, otherwise from the unit. They are independent of the purchase
 * price: moving price alone changes the capital going in, not the income.
 */
export function resolveReturnInputs({ unit, fallbackPrice = 0, purchasePrice, assumptions }: {
  unit?: Pick<UnitType, 'price_from' | 'expected_rent' | 'expected_handover_value'>
  /** project.starting_price, used when the unit carries no price */
  fallbackPrice?: number | null
  purchasePrice?: number | null
  assumptions?: ShortlistAssumptions | null
}): ResolvedReturnInputs {
  const unitPriceFrom = unit?.price_from ?? fallbackPrice ?? 0
  const price = effectivePrice(purchasePrice, unitPriceFrom)

  const seedRent = assumptions?.rent ?? unit?.expected_rent ?? price * 0.07
  const seedHV = assumptions?.handoverValue ?? unit?.expected_handover_value ?? price * 1.2

  const rentBounds = rentBoundsFor(seedRent, price)
  const hvBounds = hvBoundsFor(seedHV, price)

  return {
    price,
    rent: snapToBounds(seedRent, rentBounds),
    handoverValue: snapToBounds(seedHV, hvBounds),
    growth: assumptions?.growth ?? 5,
    holdPeriod: assumptions?.holdPeriod ?? 5,
    rentBounds,
    hvBounds,
    priceBounds: priceSliderBounds(unitPriceFrom, price),
  }
}
