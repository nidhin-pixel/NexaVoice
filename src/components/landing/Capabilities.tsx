import { Mic, Brain, Target, BarChart3, UserPlus, Workflow } from 'lucide-react';

const capabilities = [
  {
    icon: Mic,
    title: 'Real-Time Voice AI',
    description: 'Genuine two-way voice conversations powered by Agora Conversational AI — not text chat, not prerecorded audio.',
  },
  {
    icon: Brain,
    title: 'Requirement Discovery',
    description: 'The AI listens, understands context, and asks intelligent follow-up questions to uncover what your customer actually needs.',
  },
  {
    icon: Target,
    title: 'Lead Qualification',
    description: 'Transparent qualification based on real signals — company size, use case, interest level, and plan suitability.',
  },
  {
    icon: BarChart3,
    title: 'Prospect Intelligence',
    description: 'Live prospect data captured during the conversation — company, team size, requirements, and estimated deal value.',
  },
  {
    icon: UserPlus,
    title: 'Human Escalation',
    description: 'When the AI can\'t handle a request or the customer asks for a human, seamless escalation with full context handoff.',
  },
  {
    icon: Workflow,
    title: 'CRM & Sales Action',
    description: 'Qualified prospects sync directly to your CRM. The architecture is designed for clean MCP and CRM integration.',
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" className="relative py-24">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="section-eyebrow">Capabilities</span>
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
            Everything a great sales rep does — at scale
          </h2>
          <p className="mt-4 text-base text-ink-400">
            NexaVoice handles the full sales conversation workflow, from first hello to qualified opportunity.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap, i) => (
            <div
              key={cap.title}
              className="card card-hover group p-6 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400 transition-colors group-hover:bg-brand-500/20">
                <cap.icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{cap.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
