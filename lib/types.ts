/** One row of the At a glance table. Free-form rather than fixed columns,
 *  because the useful rows vary by developer. */
export type GlanceRow = {
  label: string
  value: string
}

export type Developer = {
  id: string
  slug: string
  name: string
  logo_url: string | null
  /** Short neutral summary — index card blurb and meta description.
   *  Distinct from the prose sections below, which are assessment. */
  description: string | null
  /** Admin-only scoring input for the deal builder. Never rendered publicly. */
  tier: number | null
  at_a_glance: GlanceRow[]

  /* Two free-form prose sections rendered in fixed positions on the developer
   * page. Each has an optional heading and an optional image, and each renders
   * whenever its body is set. The subject is whatever the heading says it is —
   * the columns are positional and name no subject of their own.
   *
   * Layout belongs to the position, not the content: section 1 puts its image
   * to the right of the prose, section 2 to the left, deliberately alternating
   * so the two rows don't read as a repeated pattern. Without an image, either
   * body runs the full container width.
   *
   * A null heading means the section renders with no eyebrow above it. */
  section_1_heading: string | null
  section_1_body: string | null
  section_1_image_url: string | null
  section_2_heading: string | null
  section_2_body: string | null
  section_2_image_url: string | null

  reviewed_at: string | null
}

/** A completed building that will never be listed as a project on the site. */
export type DeliveredProject = {
  id: string
  developer_id: string
  name: string
  location: string | null
  year: number | null
  image_url: string | null
  sort_order: number
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
  is_featured?: boolean | null
  featured_label?: string | null
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

/** One point in the About section. `label` is the short bold line and `detail`
 *  the sentence under it. Rows written before the column became a pair have a
 *  null label and render as the detail alone. */
export type ProjectHighlight = {
  label?: string | null
  detail: string
}

export type Project = {
  id: string
  slug: string
  name: string
  developer_id: string
  developer?: Developer
  /** Primary area within the emirate, e.g. "Dubai Creek Harbour" (formerly community) */
  location: string | null
  /** One of the seven UAE emirates; DB-constrained, defaults to 'Dubai' */
  emirate: string
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
  about_image_url?: string | null
  /** jsonb in Supabase. `label` is null on rows written before the column
   *  became a pair, and the About section renders the detail on its own in
   *  that case rather than an empty bold line. */
  highlights?: ProjectHighlight[] | null
  tagline?: string | null
  about_image_position?: string | null
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

/** Pre-filled per-client figures on a shortlist entry. Stored as jsonb;
 *  project data (prices, payment plans, handover dates) is never stored here —
 *  always read live from projects and unit_types. */
export type ShortlistAssumptions = {
  rent?: number
  handoverValue?: number
  growth?: number
  holdPeriod?: number
  financing?: 'cash' | 'mortgage'
  ltvPct?: number
  mortgageRate?: number
}

export type Shortlist = {
  id: string
  /** Unguessable public URL segment */
  token: string
  client_name: string
  intro: string | null
  /** Closing note; when null/empty the conclusion step is omitted entirely */
  conclusion: string | null
  created_at: string
  entries?: ShortlistEntry[]
}

export type ShortlistEntry = {
  id: string
  shortlist_id: string
  project_id: string
  /** The unit selected for this client; comparison row + panel default */
  unit_type_id: string | null
  /** Price actually worth analysing; null falls back to the unit's price_from */
  purchase_price: number | null
  assumptions: ShortlistAssumptions | null
  note: string
  pros: string[]
  cons: string[]
  /** null = no pick made — a valid state for a whole shortlist */
  recommended: boolean | null
  sort_order: number
  project?: Project
  unit_type?: UnitType
}

export type ShortlistViewEvent = 'open' | 'expand'

export type ShortlistView = {
  id: string
  shortlist_id: string
  entry_id: string | null
  event: ShortlistViewEvent
  created_at: string
}
