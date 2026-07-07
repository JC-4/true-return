'use client'

import LeadGenForm from '@/components/LeadGenForm'

export default function ContactPage() {
  return (
    <div className="bg-brand-bg min-h-screen">
      <div className="px-6 sm:px-10 py-16 sm:py-24">
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <p className="text-xs uppercase tracking-widest text-brand-hint font-medium mb-3 text-center">
            Independent advice
          </p>
          <h1 className="text-2xl font-semibold text-brand-text mb-2 text-center">
            Get independent advice
          </h1>
          <p className="text-sm text-brand-muted mb-8 text-center">
            Analysis and advice from an independent buyer&apos;s agent.
          </p>
          <LeadGenForm projectName="Contact page" isProjectPage={false} />
        </div>
      </div>
    </div>
  )
}
