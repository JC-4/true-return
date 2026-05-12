import Link from 'next/link'

export default function Home() {
  return (
    <div className="bg-[#fafafa] min-h-screen">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          {/* PLACEHOLDER: Update tag line */}
          <p className="text-[#71717a] text-sm font-semibold uppercase tracking-widest mb-4">
            Dubai Independent Buyer&apos;s Agent
          </p>
          {/* PLACEHOLDER: Update headline */}
          <h1 className="text-4xl sm:text-5xl font-bold text-[#18181b] leading-tight mb-6">
            Find the right property.<br />
            <span className="text-[#27272a]">Know exactly what it&apos;s worth.</span>
          </h1>
          {/* PLACEHOLDER: Update subheading */}
          <p className="text-[#71717a] text-lg leading-relaxed mb-10">
            I help investors cut through Dubai&apos;s off-plan noise and buy property
            with clear eyes — the right unit, at the right price, with real numbers
            behind every decision.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* PLACEHOLDER: Replace +971XXXXXXXXX with your WhatsApp number */}
            <a
              href="https://wa.me/971XXXXXXXXX"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>
            {/* PLACEHOLDER: Replace hello@yourdomain.com with your email */}
            <a
              href="mailto:hello@yourdomain.com"
              className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-6 py-3 rounded-lg border border-[#e4e4e7] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email me
            </a>
          </div>
        </div>
      </section>

      {/* What I do */}
      <section className="border-t border-[#e4e4e7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          {/* PLACEHOLDER: Update section heading */}
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#71717a] mb-12">
            What I do
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {/* PLACEHOLDER: Update each service card */}
            {[
              {
                title: 'Deal sourcing',
                body: 'Placeholder — describe how you identify and shortlist opportunities across Dubai\'s primary and secondary markets.',
              },
              {
                title: 'Independent analysis',
                body: 'Placeholder — describe your approach to underwriting: yield modelling, comparable analysis, developer track record.',
              },
              {
                title: 'End-to-end support',
                body: 'Placeholder — describe what you handle from first look to keys: negotiation, legal, payments, handover.',
              },
            ].map(({ title, body }) => (
              <div key={title} className="border-t border-[#e4e4e7] pt-6">
                <h3 className="text-[#18181b] font-semibold text-base mb-3">{title}</h3>
                <p className="text-[#71717a] text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-[#e4e4e7] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            {/* PLACEHOLDER: Update CTA heading and sub-text */}
            <h2 className="text-[#18181b] font-bold text-xl mb-1">Ready to run the numbers?</h2>
            <p className="text-[#71717a] text-sm">Use the investment calculator or get in touch directly.</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <Link
              href="/calculators/investment"
              className="bg-[#18181b] hover:bg-[#27272a] text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors"
            >
              Open calculator
            </Link>
            <Link
              href="/work-with-me"
              className="bg-transparent border border-[#e4e4e7] text-[#71717a] font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-[#e4e4e7] transition-colors"
            >
              Work with me
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
