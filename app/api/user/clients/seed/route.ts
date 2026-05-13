import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redis } from '@/lib/redis'

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

function generateId(length = 8): string {
  let id = ''
  for (let i = 0; i < length; i++) id += CHARS[Math.floor(Math.random() * CHARS.length)]
  return id
}

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const KNOWLEDGE_BASE = `Jackson Crosland — Dubai Real Estate Market Knowledge Base
This document represents Jackson's personal views, experience, and investment philosophy built over years as a buyer's broker in Dubai. It should be used to inform recommendations, assess opportunities, and advise clients.

Developer Views
Ellington Properties ⭐ Recommended
Fantastic developer and one of Jackson's most-sold. Founded by Robert Booth, who spent over a decade at Emaar in senior roles before launching Ellington. Design-first, boutique approach with consistently high build quality. Fully fitted with appliances unlike most major developers — this matters to end users and drives above-average rents and occupancy.
Strengths:
- Outperforms area averages on rental yields and capital appreciation in every community they operate in
- Ellington House (Dubai Hills Estate) achieves rents significantly above DHE average — 1-beds at AED 152k vs area average of AED 101k; 2-beds at AED 265k vs AED 159k
- Gross yields ~8%, net ~6-7% — strong for Dubai
- Well-maintained buildings years after handover
- End-user focused: practical layouts, great amenities, fully fitted with appliances
- Attracts quality long-term tenants which supports values
- Strong performance in multiple communities including Dubai Hills Estate, Sobha Hartland, and JVC

Cautions:
- Newer launches are expensive — they price in a lot of the upside, less room for growth than 2-3 years ago. Not every project works as an investment — entry price and phase matters enormously. Buying early is key
- Increasing project volume creates delay risk — Ellington House was delivered late. More recent launches have longer delivery timelines
- Always check escrow account status before recommending
- Recommend snagging on handover

Who it suits: Both end users and investors. End users love the quality and liveability. Investors benefit from strong rental demand and above-average yields.

Imtiaz Developments ⭐ Highly Recommended
One of Jackson's current top recommendations — often recommended ahead of Ellington due to more attractive price points and more flexible payment plans. Founded in 1993, with in-house construction. Portfolio exceeds AED 10 billion across 40+ active projects.
Strengths:
- All units delivered fully furnished and fitted to a high standard — strong rental appeal from day one
- In-house construction model — better quality control and timeline accountability
- Exceptional delivery track record — projects delivered on time or early (Pearl House II delivered 3 months ahead of schedule)
- Flexible payment plans typically 60/40 construction-linked
- Strong locations across Dubai Islands, JVC, Dubailand, Meydan
- Yields 6-8% with strong capital appreciation

Notable projects: Beach Walk series on Dubai Islands, Pearl House series in JVC, Cove Edition in Dubailand, Symphony in Meydan (designed by Zaha Hadid Architects)
Who it suits: Investors prioritising rental yield and capital growth at a more accessible price point than Ellington. Particularly strong for buy-to-let given fully furnished delivery.

Iman Developers ⭐ Highly Recommended
Founded in 2016, quality-over-quantity approach. Consistent on-time delivery (won Dubai Land Department Speed of Development Award). High quality finishes, smart home integration. Properties typically unfurnished unlike Imtiaz — investor clients focused on immediate rental income may prefer Imtiaz; end users happy to furnish may prefer Iman's price point.
Notable projects: One Park Square, One Sky Park (both sold out — strong demand signal), Sierra by Iman in Motor City (Top 100 Luxury Residences of the World 2025).
Who it suits: Both investors and end users. Good for clients wanting Ellington-quality aesthetics at a more competitive price.

Select Group ⭐ Recommended
Fantastic developer — similar philosophy to Ellington but more boutique. Good value, investor-friendly payment plans. Jackson hasn't sold Select yet but actively looking to. Don't release many projects so usually have stock available — no pressure at launch, which Jackson prefers.
Notable project: Artistry in Dubai Design District — fairly priced, looks exceptional.

Emaar Properties ✅ Solid
Dubai's largest listed developer. Government-linked. Solid reputation, iconic master communities, strong brand globally.
Caution: Payment plan is 80% during construction and 20% on handover — very cash heavy during build. High pricing, limited upside. Good for conservative clients who prioritise safety.

Dubai Holding Group ✅ Government-Backed
Nakheel, Meraas, and Dubai Properties all sit under Dubai Holding — owned by the Government of Dubai.
Nakheel ✅ Solid — Improved build quality after 2009 debt crisis. Behind Palm Jumeirah, The World Islands, Palm Jebel Ali, Dubai Islands. Reliable, slightly conservative in design.
Meraas ✅ Good — More premium lifestyle brand. Behind Bluewaters Island, City Walk, Port de La Mer, Dubai Harbour. Good quality, Acres community looks fantastic.
Dubai Properties ✅ Decent — Good communities, below Emaar/Nakheel in quality but priced accordingly. Behind JBR, Business Bay developments.

Majid Al Futtaim ⭐ Recommended
Great developer. Part of one of the UAE's largest private conglomerates (Mall of the Emirates, Carrefour, Vox Cinemas).
Tilal Al Ghaf — success story. Ready community, very green, high quality, unique at handover.
Ghaf Woods — off-plan apartment community with forest/nature theme. Strong conceptual appeal.

Aldar Properties ✅ Solid — Abu Dhabi
Abu Dhabi's largest developer. Very safe, great communities, government-linked. Jackson's primary reference for Abu Dhabi. Strong long-term fundamentals, less speculative than Dubai but potentially more sustainable for capital preservation.

Modon Properties ⭐ Actively Pushing in 2025/2026
Government-owned Abu Dhabi developer. Jackson will be pushing Modon heavily this year.
Hudayriyat Island — Jackson's view: "I want to live there — it has everything." Exceptional master development, strong lifestyle proposition, very favourable payment plans and pricing.
Key consideration: Modon hasn't delivered completed projects yet — track record unproven. Government ownership means confidence is high, similar to Aldar.
Who it suits: Clients open to Abu Dhabi, or those wanting waterfront lifestyle at a price point below Dubai equivalents.

Sobha Realty ✅ Good — with caveats
Fantastic quality and great finishes. Popular with end users. Too many units in many projects — this makes capital appreciation more difficult as internal supply weighs on resale values. Good yields. Always assess the specific project. Sobha Hartland 1 is one of Jackson's key communities.

Damac Properties ⚠️ Caution
Has improved but historically poor construction quality. Jackson generally steers clients away. Too many units, small layouts, tiny plot sizes. Low entry price only positive.

Samana Developers ⚠️ Caution
Similar category to Damac. Not a developer Jackson actively recommends.

Danube Properties ❌ Will Not Sell
Jackson will never recommend Danube under any circumstances.

Reportage Properties ❌ Will Not Sell
Same category as Danube.

Omniyat ✅ Great — Not Jackson's Market
Fantastic ultra-luxury developer. Not Jackson's client bracket currently but quality is exceptional.

Investment Philosophy
Off-Plan Assessment Framework
The core rule: Off-plan must be cheaper than comparable ready product in the same or similar area. If it isn't, it doesn't make sense — you're taking on delivery risk for no discount.
Key assessment criteria:
- Price vs comparable ready product — the starting point
- Developer track record — quality, delivery, post-handover management
- Supply in the area — critical and consistently underestimated by buyers
- Payment plan — cash flow matters
- Layout and size — small layouts hurt rental demand and resale
- Phase of purchase — early phases offer best value

Red Flags
- High supply areas — JVC currently oversupplied
- Small layouts
- Developers with poor track records (Danube, Reportage)
- Off-plan at or above ready comparable pricing
- Areas with massive incoming supply over next 3-4 years

Current Market View (2025/2026)
Dubai still offers value but you have to work to find it. The easy money era is over. Significant supply incoming over the next 3-4 years which will affect some areas more than others. Good opportunity still exists but requires proper analysis, the right developer, right area, right entry price.

Mortgage Equity Release Strategy
A signature approach that differentiates Jackson from most brokers. Clients who already own Dubai property are often sitting on significant unrealised equity. A mortgage equity release frees up that capital without selling the existing asset to fund a new purchase.
When it makes sense: Client has strong equity and wants to expand their portfolio. New asset should generate returns covering the additional borrowing cost. Example: Kieran & Christie's villa equity release expected to free ~AED 800k toward a new AED 2-3M investment.
When it doesn't: Downward trending market.

Service Ecosystem
Jackson refers clients to trusted partners: mortgages (equity release and new purchases), FX (currency exchange), interior design (post-handover), renovations (value-add on secondary). These referrals serve the client and generate commission.`

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as { id?: string }).id!

  const [existing, existingKnowledge] = await Promise.all([
    redis.get(`clients:${userId}`),
    redis.get(`knowledge:${userId}`),
  ])

  // Always seed knowledge if missing, even if clients already exist
  if (!existingKnowledge) {
    await redis.set(`knowledge:${userId}`, KNOWLEDGE_BASE)
  }

  if (existing && Array.isArray(existing) && (existing as unknown[]).length > 0) {
    return NextResponse.json({ ok: true, message: 'Clients already seeded — skipped' })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const savedAt = now.toISOString()

  const clients = [
    {
      id: generateId(),
      name: 'Kieran & Christie',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 2_000_000,
      maxBudgetAED: 3_000_000,
      mortgageStatus: 'Mortgage (equity release)',
      nextFollowUp: today,
      followUpAction: 'Call Kieran — break news about Scope Properties pausing bookings, explore alternatives including Abu Dhabi and Ellington off plan.',
      notes: 'Sold them a villa ~18 months ago. Looking for investment property. Mortgage equity release on existing villa to free ~800k. Scope Properties (Wasl Gate) fell through — developer paused bookings due to geopolitical situation. Pitched Ellington off plan (7% guaranteed returns). Open to Abu Dhabi long-term.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Quentin',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Villa',
      nextFollowUp: addDays(now, 7),
      followUpAction: 'Find the right moment — don\'t push product. Re-engage gently.',
      notes: 'High-value slow-burn client. Sold him 3-bed Ellington House (3.8M, now worth ~6M), currently upgrading and moving in. Interested in off plan investments and future villa ~10–12M. Sent Hudayriyat info — interested but went silent on follow-up launch. Don\'t push product, find the right moment.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Michel & Nathalie',
      status: 'Active' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 3_000_000,
      maxBudgetAED: 5_000_000,
      nextFollowUp: addDays(now, 3),
      followUpAction: 'Re-engage — check in and explore 2-bed Ellington House options.',
      notes: 'Sold them 1-bed Ellington House, currently rented out. Interested in buying 2-bed Ellington House to live in themselves. Open to off plan. Haven\'t spoken recently.',
      savedAt,
      updatedAt: savedAt,
    },
    {
      id: generateId(),
      name: 'Shankar',
      status: 'Paused' as const,
      market: ['Off Plan', 'Secondary'] as ('Off Plan' | 'Secondary')[],
      propertyType: 'Apartment',
      minBudgetAED: 1_500_000,
      maxBudgetAED: 3_000_000,
      nextFollowUp: addDays(now, 7),
      followUpAction: 'Soft re-engagement — relationship first, product second.',
      notes: 'Sold him 1-bed Ellington House. Was looking at selling it and upgrading to 2-bed in Fortimo Golf Residences, and an investment apartment in Abu Dhabi. Went cold when geopolitical conflict started. Needs soft re-engagement — relationship first, product second.',
      savedAt,
      updatedAt: savedAt,
    },
  ]

  const index = clients.map(c => ({
    id: c.id,
    name: c.name,
    status: c.status,
    savedAt: c.savedAt,
    updatedAt: c.updatedAt,
  }))

  await Promise.all([
    ...clients.map(c => redis.set(`client:${userId}:${c.id}`, c)),
    redis.set(`clients:${userId}`, index),
  ])

  return NextResponse.json({ ok: true, message: `Seeded ${clients.length} clients`, ids: clients.map(c => c.id) })
}
