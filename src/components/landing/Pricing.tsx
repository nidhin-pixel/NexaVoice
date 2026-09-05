import { Check } from 'lucide-react';
import { PRODUCT_PLANS, formatPrice } from '@/data/products';

export function Pricing() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Plans & Pricing</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-base text-ink-400">
            The AI agent recommends the right plan based on each customer's team size and needs.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {PRODUCT_PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className={`card relative p-7 animate-slide-up ${
                plan.highlight
                  ? 'border-brand-500/40 bg-brand-500/[0.04] shadow-glow'
                  : 'card-hover'
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="font-display text-xl font-bold text-white">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-400">{plan.tagline}</p>
              <div className="mt-5">
                <span className="font-display text-3xl font-bold text-white">
                  {formatPrice(plan)}
                </span>
              </div>
              <div className="mt-1 text-sm text-ink-400">Up to {plan.maxUsers} users</div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm text-ink-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" strokeWidth={2.5} />
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
