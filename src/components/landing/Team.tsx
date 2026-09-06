import { Linkedin, ArrowUpRight } from 'lucide-react';

const builders = [
  {
    initial: 'N',
    name: 'Nidhi Nagar',
    role: 'Builder & AI Engineer',
    bio: 'BCA student and AI-focused software builder working across backend development, AI integration, real-time voice systems, and product prototyping.',
    education: null,
    linkedin: 'https://www.linkedin.com/in/nidhi-n-b68920328/',
  },
  {
    initial: 'A',
    name: 'Ashi Shukla',
    role: 'Co-Builder',
    bio: 'B.Tech Computer Science student at Presidency University Bangalore, contributing to product development and building NexaVoice as part of the two-person team.',
    education: "Bachelor's Degree, Computer Science",
    linkedin: 'https://www.linkedin.com/in/ashi-shukla-2b6464359/',
  },
];

export function Team() {
  return (
    <section id="team" className="relative overflow-hidden py-24">
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-brand-400/20 to-transparent" />
      <div className="container-page relative">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">The Team</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            Meet the Builders
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-400">
            Built by a two-person team focused on turning real-time voice AI into a practical sales experience.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-2">
          {builders.map((builder, index) => (
            <article
              key={builder.name}
              className="group card relative overflow-hidden p-7 transition-all duration-300 hover:-translate-y-1 hover:border-brand-400/30 hover:bg-white/[0.06]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-300/20 bg-gradient-to-br from-brand-500/25 to-accent-500/10 font-display text-2xl font-bold text-brand-200">
                  {builder.initial}
                </div>
                <span className="chip border border-white/10 bg-white/5 text-brand-200">{builder.role}</span>
              </div>
              <h3 className="relative mt-7 font-display text-2xl font-bold text-white">{builder.name}</h3>
              <p className="relative mt-3 min-h-[5.5rem] text-sm leading-relaxed text-ink-300">{builder.bio}</p>
              {builder.education && (
                <p className="relative mt-4 text-xs font-medium uppercase tracking-wider text-ink-500">
                  {builder.education}
                </p>
              )}
              <a
                href={builder.linkedin}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${builder.name}'s LinkedIn profile`}
                className="relative mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-300 transition-colors hover:text-white"
              >
                <Linkedin className="h-4 w-4" aria-hidden="true" />
                LinkedIn
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
