import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Uncomment the line below to enable static export for CDN/non-Vercel deploys:
  // output: 'export',
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/calculator',          destination: '/calculators/investment', permanent: true },
      { source: '/calculator/mortgage', destination: '/calculators/mortgage',   permanent: true },
    ]
  },
}

export default nextConfig
