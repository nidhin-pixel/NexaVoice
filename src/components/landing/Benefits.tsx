import { TrendingUp, Clock, Users, Shield } from 'lucide-react';

const benefits = [
  {
    icon: Clock,
    title: '24/7 Availability',
    description: 'Never miss a lead. The AI agent handles conversations around the clock, across time zones, without fatigue.',
    stat: '24/7',
    statLabel: 'Always on',
  },
  {
    icon: TrendingUp,
    title: 'Higher Conversion',
    description: 'Every conversation is consistent, thorough, and optimized for discovery — no more rushed or missed qualifying questions.',
    stat: '3x',
    statLabel: 'More qualified leads',
  },
  {
    icon: Users,
    title: 'Scales With Your Team',
    description: 'Handle hundreds of simultaneous conversations without hiring more reps. Your human team focuses on closing, not screening.',
    stat: '100+',
    statLabel: 'Concurrent calls',
  },
  {
    icon: Shield,
    title: 'Consistent Quality',
    description: 'Every customer gets the same thorough discovery process. No off days, no skipped questions, no missed follow-ups.',
    stat: '100%',
    statLabel: 'Consistency',
  },
];

export function Benefits() {
  return (
    <section className="relative py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Benefits</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            Built for sales teams that want to scale
          </h2>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className="card card-hover flex items-start gap-5 p-6 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10">
                <b.icon className="h-6 w-6 text-brand-300" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-lg font-semibold text-white">{b.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{b.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-2xl font-bold text-brand-300">{b.stat}</div>
                <div className="text-xs text-ink-500">{b.statLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
