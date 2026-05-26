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
}

export type ConnectivityItem = {
  label: string
  time: string
}

export type PaymentSegment = {
  label: string
  percent: number
  color: 'bronze' | 'bronze-mid' | 'bronze-light'
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
}
