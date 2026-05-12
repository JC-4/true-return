export default function AreasPage() {
  /* PLACEHOLDER: Replace these placeholder area cards with real content */
  const placeholderAreas = [
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
    { name: 'Area Name Placeholder', tag: 'Coming soon', description: 'A detailed guide to this submarket — key developments, yield profiles, who buys here and why — will appear here.' },
  ]

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-12">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Area guides</p>
          {/* PLACEHOLDER: Update section heading */}
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Dubai neighbourhood guides</h1>
          {/* PLACEHOLDER: Update intro copy */}
          <p className="text-gray-600 text-base max-w-xl">
            Submarket-level analysis for investors: yield expectations, stock quality, rental demand drivers, and what to avoid.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {placeholderAreas.map((area, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-xl p-6 opacity-60 cursor-not-allowed"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-gray-900 font-semibold">{area.name}</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex-shrink-0 ml-2">
                  {area.tag}
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{area.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
