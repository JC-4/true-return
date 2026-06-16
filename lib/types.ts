export type Developer = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  description: string | null
  founded_year: number | null
  portfolio_value: string | null
  delivered_units: number | null
  website: string | null
}

export type UnitType = {
  id: string
  project_id: string
  type: string
  price_from: number
  size_sqft_from: number
  price_per_sqft: number
  bedrooms: number | null   // 0 = studio, 1/2/3 = residential, null = commercial
  typology: string | null   // distinguishing label within a bedroom count (e.g. "Suite", "Standard"); null if unique
  internal_sqft?: number | null
  balcony_sqft?: number | null
  expected_rent?: number | null
  expected_handover_value?: number | null
  floor_plan_url?: string | null
}

export type ConnectivityItem = {
  label: string
  time: string
}

export type PaymentSegment = {
  label: string
  percent: number
  color: 'bronze' | 'bronze-mid' | 'bronze-light'
  date?: string
}

export type PaymentPlan = {
  name: string
  segments: PaymentSegment[]
}

export type FaqItem = {
  q: string
  a: string
}

export type Project = {
  id: string
  slug: string
  name: string
  developer_id: string
  developer?: Developer
  location: string | null
  community: string | null
  status: string | null
  handover_date: string | null
  starting_price: number | null
  description: string | null
  brochure_url: string | null
  images: string[]
  amenities: string[]
  connectivity: ConnectivityItem[]
  payment_plans: PaymentPlan[]
  faqs: FaqItem[]
  unit_types?: UnitType[]
  service_charge_rate?: number | null
  downpayment_pct?: number | null
  payment_plan_confirmed?: boolean | null
  map_embed_html?: string | null
}

export type DeveloperWithCount = Developer & { project_count: number }
export type DeveloperWithProjects = Developer & { projects: Project[] }

export type InsightDocument = {
  label: string
  url: string
  type: 'brochure' | 'floor_plans' | 'other'
}

export type ProjectInsight = {
  insight_opinion?: string
  insight_projections?: string
  insight_risks?: string
  documents?: InsightDocument[]
  /** Default deal-builder params saved by the admin. Applied as initial values for
   *  any visitor who opens /projects/[slug]/insight without a snapshot ID. */
  defaultParams?: Record<string, unknown>
}
