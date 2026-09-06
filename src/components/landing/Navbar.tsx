import { PhoneCall } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NavbarProps {
  onStartConversation: () => void;
}

export function Navbar({ onStartConversation }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/10 bg-ink-950/80 backdrop-blur-lg'
          : 'border-b border-transparent'
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <PhoneCall className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-bold text-white">NexaVoice</span>
        </div>

        <nav className="hidden items-center gap-8 sm:flex">
          <a href="#how-it-works" className="text-sm text-ink-300 transition-colors hover:text-white">How It Works</a>
          <a href="#capabilities" className="text-sm text-ink-300 transition-colors hover:text-white">Capabilities</a>
          <a href="#pricing" className="text-sm text-ink-300 transition-colors hover:text-white">Pricing</a>
          <a href="#team" className="text-sm text-ink-300 transition-colors hover:text-white">Team</a>
        </nav>

        <button onClick={onStartConversation} className="btn-primary text-sm">
          <PhoneCall className="h-4 w-4" strokeWidth={2} />
          Start Conversation
        </button>
      </div>
    </header>
  );
}
