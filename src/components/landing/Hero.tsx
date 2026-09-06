import { PhoneCall, Play, ArrowRight } from 'lucide-react';

interface HeroProps {
  onStartConversation: () => void;
}

export function Hero({ onStartConversation }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-20">
      {/* Background effects */}
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute inset-0 radial-glow" />
      <div className="absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]" />
      <HeroSignal />

      <div className="container-page relative">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="text-center lg:text-left">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-ink-300 animate-fade-in-fast">
            <span className="flex h-2 w-2">
              <span className="absolute h-2 w-2 animate-ping rounded-full bg-brand-400 opacity-75" />
              <span className="h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Powered by Agora Conversational AI
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl animate-fade-in">
            NexaVoice
          </h1>
          <p className="mt-3 font-display text-2xl font-semibold text-brand-300 sm:text-3xl animate-fade-in" style={{ animationDelay: '100ms' }}>
            Give Sales a Voice.
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-300 animate-fade-in lg:mx-0" style={{ animationDelay: '200ms' }}>
            An AI sales agent that has real conversations, understands customer needs,
            recommends the right solution, and turns conversations into qualified opportunities.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start animate-fade-in" style={{ animationDelay: '300ms' }}>
            <button onClick={onStartConversation} className="btn-primary group text-base">
              <PhoneCall className="h-5 w-5" strokeWidth={2} />
              Start a Live Conversation
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a href="#how-it-works" className="btn-secondary text-base">
              <Play className="h-4 w-4" strokeWidth={2} />
              See How It Works
            </a>
          </div>
          </div>
        </div>

        {/* Visual: workflow preview */}
        <div className="mx-auto mt-20 max-w-5xl animate-scale-in" style={{ animationDelay: '400ms' }}>
          <div className="card overflow-hidden p-2">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-error-500/60" />
                <div className="h-3 w-3 rounded-full bg-warning-500/60" />
                <div className="h-3 w-3 rounded-full bg-success-500/60" />
              </div>
              <div className="ml-2 text-xs text-ink-500">NexaVoice — Live Sales Workspace</div>
            </div>
            <div className="grid grid-cols-3 gap-2 p-2">
              {/* Transcript preview */}
              <div className="space-y-2 rounded-xl bg-white/[0.02] p-3">
                <div className="text-xs font-semibold text-ink-400">LIVE TRANSCRIPT</div>
                <div className="space-y-2">
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-ink-300">
                    "Hi, I'm exploring AI sales tools..."
                  </div>
                  <div className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-brand-200">
                    "Welcome! Could you tell me about your company?"
                  </div>
                  <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-ink-300">
                    "We're Brightwave Labs, about 35 people..."
                  </div>
                </div>
              </div>

              {/* Agent preview */}
              <div className="flex flex-col items-center justify-center rounded-xl bg-white/[0.02] p-3">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <div className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/20" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700">
                    <PhoneCall className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="mt-3 text-xs font-semibold text-white">NexaVoice</div>
                <div className="mt-1 flex items-end gap-0.5">
                  {[0.3, 0.6, 1, 0.7, 0.4].map((h, i) => (
                    <div
                      key={i}
                      className="voice-bar w-1 rounded-full bg-brand-400"
                      style={{ height: `${h * 16}px`, animationDelay: `${i * 100}ms` }}
                    />
                  ))}
                </div>
              </div>

              {/* Prospect preview */}
              <div className="space-y-2 rounded-xl bg-white/[0.02] p-3">
                <div className="text-xs font-semibold text-ink-400">PROSPECT INTEL</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">Company</span>
                    <span className="text-white">Brightwave</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">Team</span>
                    <span className="text-white">35</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">Interest</span>
                    <span className="text-success-400">High</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">Plan</span>
                    <span className="text-brand-300">Business</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-500">Status</span>
                    <span className="chip bg-success-500/15 px-1.5 py-0.5 text-success-400">Qualified</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroSignal() {
  return (
    <div className="pointer-events-none absolute right-[-12rem] top-24 hidden h-[34rem] w-[34rem] opacity-80 lg:block" aria-hidden="true">
      <div className="absolute inset-12 rounded-full border border-brand-300/10 animate-float" />
      <div className="absolute inset-20 rounded-full border border-accent-400/15" />
      <div className="absolute inset-28 rounded-full border border-white/10" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.16),transparent_58%)]" />
      <svg viewBox="0 0 560 560" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="voice-line" x1="0" x2="1">
            <stop offset="0" stopColor="#2cc5f3" stopOpacity="0" />
            <stop offset="0.5" stopColor="#6eddfa" stopOpacity="0.85" />
            <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M20 282 C100 210 142 360 214 280 S330 190 390 278 S470 350 540 250" fill="none" stroke="url(#voice-line)" strokeWidth="2" className="voice-signal" />
        <path d="M20 310 C105 260 150 332 220 302 S334 242 405 300 S485 326 540 288" fill="none" stroke="#2cc5f3" strokeOpacity="0.25" />
        <path d="M78 130 L180 214 L292 104 L410 194 L486 132" fill="none" stroke="#6eddfa" strokeOpacity="0.12" strokeDasharray="3 10" />
        <g fill="#6eddfa">
          <circle cx="180" cy="214" r="4" className="signal-node" />
          <circle cx="292" cy="104" r="3" className="signal-node signal-node-delay" />
          <circle cx="410" cy="194" r="4" className="signal-node" />
          <circle cx="390" cy="278" r="3" className="signal-node signal-node-delay" />
        </g>
      </svg>
      <div className="absolute left-16 top-24 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-200/60">Real-time</div>
      <div className="absolute right-14 top-44 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-400/70">Voice AI</div>
      <div className="absolute bottom-28 left-20 text-[10px] font-semibold uppercase tracking-[0.28em] text-accent-300/60">Qualification</div>
      <div className="absolute bottom-20 right-16 text-[10px] font-semibold uppercase tracking-[0.28em] text-ink-400/70">CRM</div>
    </div>
  );
}
