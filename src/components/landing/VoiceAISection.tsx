import { Phone, PhoneOff, Mic, MicOff, Headphones, UserCog, Database } from 'lucide-react';

const features = [
  {
    icon: Phone,
    title: 'Real-Time Two-Way Voice',
    description: 'Agora Conversational AI pipeline handles ASR, LLM reasoning, and TTS for natural, low-latency conversations.',
  },
  {
    icon: Headphones,
    title: 'Live Transcript',
    description: 'Every conversation is transcribed in real time, so your team can follow along and review later.',
  },
  {
    icon: UserCog,
    title: 'Human + AI Collaboration',
    description: 'The AI handles discovery and qualification. When needed, it escalates to a human with full context.',
  },
  {
    icon: Database,
    title: 'CRM Sync Ready',
    description: 'Qualified prospects are structured for direct CRM synchronization. MCP integration is built into the architecture.',
  },
];

export function VoiceAISection() {
  return (
    <section className="relative py-24">
      <div className="container-page">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="section-eyebrow">Real-Time Voice AI</span>
            <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
              Not a chatbot. A voice sales representative.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-400">
              NexaVoice uses Agora Conversational AI to power genuine two-way voice interactions.
              The customer speaks naturally. The AI listens, reasons, and responds in real time —
              just like a skilled sales rep would.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-400">
              No forms to fill out. No IVR menus to navigate. Just a conversation that moves the
              prospect from curiosity to qualification.
            </p>

            <div className="mt-8 space-y-4">
              {features.map((f) => (
                <div key={f.title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                    <f.icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                    <p className="mt-0.5 text-sm text-ink-400">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual: Agent card mockup */}
          <div className="relative">
            <div className="card mx-auto max-w-sm p-8 animate-scale-in">
              <div className="flex items-center justify-between">
                <span className="chip bg-success-500/15 text-success-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success-400" />
                  Connected
                </span>
                <span className="text-xs text-ink-500">Live Demo</span>
              </div>

              {/* Agent orb */}
              <div className="my-10 flex justify-center">
                <div className="relative flex h-32 w-32 items-center justify-center">
                  <div className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/20" />
                  <div className="absolute inset-2 animate-pulse-ring rounded-full bg-brand-500/15" style={{ animationDelay: '0.6s' }} />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
                    <Phone className="h-8 w-8 text-white" strokeWidth={2} />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-sm font-semibold text-white">AI Sales Agent</div>
                <div className="mt-1 text-xs text-ink-400">Listening...</div>
              </div>

              {/* Voice bars */}
              <div className="mt-6 flex items-end justify-center gap-1">
                {[0.3, 0.6, 1, 0.7, 0.4, 0.8, 0.5, 0.9, 0.6, 0.3].map((h, i) => (
                  <div
                    key={i}
                    className="voice-bar w-1.5 rounded-full bg-brand-400"
                    style={{ height: `${h * 32}px`, animationDelay: `${i * 100}ms` }}
                  />
                ))}
              </div>

              {/* Mini controls */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-ink-300">
                  <Mic className="h-4 w-4" />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error-500/15 text-error-400">
                  <PhoneOff className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
