import { ArrowRight } from 'lucide-react';

const steps = [
  { label: 'Customer', sub: 'Inbound call' },
  { label: 'Voice AI', sub: 'Real-time conversation' },
  { label: 'Discovery', sub: 'Understand needs' },
  { label: 'Recommendation', sub: 'Right plan fit' },
  { label: 'Qualification', sub: 'Score the lead' },
  { label: 'Sales', sub: 'CRM action' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">How It Works</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            From conversation to closed deal
          </h2>
          <p className="mt-4 text-base text-ink-400">
            A complete voice sales workflow — not just a voice-enabled chatbot.
          </p>
        </div>

        <div className="mt-16 overflow-x-auto pb-4">
          <div className="flex min-w-max items-center justify-center gap-2 sm:gap-3">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2 sm:gap-3">
                <div
                  className="card flex flex-col items-center gap-1 px-5 py-6 text-center animate-scale-in"
                  style={{ animationDelay: `${i * 100}ms`, minWidth: '140px' }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-300">
                    {i + 1}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{step.label}</div>
                  <div className="text-xs text-ink-400">{step.sub}</div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="h-5 w-5 shrink-0 text-ink-500" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
