import { PhoneCall, ArrowRight } from 'lucide-react';

interface CTAProps {
  onStartConversation: () => void;
}

export function CTA({ onStartConversation }: CTAProps) {
  return (
    <section className="relative py-24">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-600/20 via-ink-900 to-ink-950 px-8 py-16 text-center sm:px-16">
          <div className="absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px]" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Ready to give your sales a voice?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-ink-300">
              Start a live conversation with our AI sales agent and experience the full NexaVoice workflow — from discovery to qualified lead.
            </p>
            <button
              onClick={onStartConversation}
              className="btn-primary group mt-8 text-base"
            >
              <PhoneCall className="h-5 w-5" strokeWidth={2} />
              Start a Live Conversation
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="container-page">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <PhoneCall className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold text-white">NexaVoice</span>
          </div>
          <p className="text-sm text-ink-500">
            Give Sales a Voice. Built with Agora Conversational AI.
          </p>
          <div className="flex gap-6 text-sm text-ink-400">
            <a href="#how-it-works" className="transition-colors hover:text-white">How It Works</a>
            <a href="#capabilities" className="transition-colors hover:text-white">Capabilities</a>
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
