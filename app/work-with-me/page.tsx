import Link from 'next/link'

export default function WorkWithMePage() {
  /* PLACEHOLDER: Update each step with your actual process */
  const steps = [
    {
      number: '01',
      title: 'Discovery call',
      body: 'Placeholder — describe your first conversation: budget, investment goals, timeline, risk appetite. Explain what you figure out together.',
    },
    {
      number: '02',
      title: 'Shortlist & analysis',
      body: 'Placeholder — describe how you identify 3–5 qualifying opportunities and model each one with real numbers.',
    },
    {
      number: '03',
      title: 'Site visits & due diligence',
      body: 'Placeholder — describe what you check on the ground, developer track record reviews, legal title verification.',
    },
    {
      number: '04',
      title: 'Negotiation & purchase',
      body: 'Placeholder — describe your role at the offer stage, handling SPA review, payment plan, and DLD registration.',
    },
    {
      number: '05',
      title: 'Post-purchase support',
      body: 'Placeholder — describe handover management, snag lists, property management introductions, and anything else you handle after purchase.',
    },
  ]

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="max-w-2xl mb-16">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">How it works</p>
          {/* PLACEHOLDER: Update headline */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Work with me</h1>
          {/* PLACEHOLDER: Update intro copy */}
          <p className="text-gray-600 text-base leading-relaxed">
            Placeholder — 2–3 sentences positioning your service. Who it&apos;s for, what makes it different from going direct to a developer or using a selling agent.
          </p>
        </div>

        {/* Process steps */}
        <div className="max-w-2xl mb-16">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-8">The process</h2>
          <div className="space-y-8">
            {steps.map(({ number, title, body }) => (
              <div key={number} className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center">
                  <span className="text-gray-500 text-xs font-semibold">{number}</span>
                </div>
                <div className="pt-1.5">
                  <h3 className="text-gray-900 font-semibold mb-1.5">{title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment model */}
        <div className="max-w-2xl mb-16 bg-white border border-gray-200 rounded-xl p-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">Fee structure</h2>
          {/* PLACEHOLDER: Update fee structure description */}
          <p className="text-gray-900 font-semibold mb-2">Placeholder fee model headline</p>
          <p className="text-gray-600 text-sm leading-relaxed">
            Placeholder — describe your payment model clearly. E.g. fixed advisory fee, success fee on purchase, retainer, or some combination. Be direct about numbers if possible — it builds trust with serious buyers.
          </p>
        </div>

        {/* CTA */}
        <div className="max-w-2xl">
          <h2 className="text-gray-900 font-bold text-xl mb-3">Ready to start?</h2>
          {/* PLACEHOLDER: Update CTA copy */}
          <p className="text-gray-600 text-sm mb-6">
            Placeholder — short, direct call to action. What happens when they reach out, how quickly you respond, what they should have ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* PLACEHOLDER: Replace +971XXXXXXXXX with your WhatsApp number */}
            <a
              href="https://wa.me/971XXXXXXXXX"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp me
            </a>
            {/* PLACEHOLDER: Replace hello@yourdomain.com with your email */}
            <a
              href="mailto:hello@yourdomain.com"
              className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-6 py-3 rounded-lg border border-gray-200 transition-colors text-sm"
            >
              Send an email
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
