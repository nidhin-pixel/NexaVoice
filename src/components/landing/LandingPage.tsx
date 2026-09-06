import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Capabilities } from '@/components/landing/Capabilities';
import { VoiceAISection } from '@/components/landing/VoiceAISection';
import { Benefits } from '@/components/landing/Benefits';
import { Pricing } from '@/components/landing/Pricing';
import { Team } from '@/components/landing/Team';
import { CTA, Footer } from '@/components/landing/CTA';

interface LandingPageProps {
  onStartConversation: () => void;
}

export function LandingPage({ onStartConversation }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-ink-950">
      <Navbar onStartConversation={onStartConversation} />
      <main>
        <Hero onStartConversation={onStartConversation} />
        <HowItWorks />
        <Capabilities />
        <VoiceAISection />
        <Benefits />
        <Pricing />
        <Team />
        <CTA onStartConversation={onStartConversation} />
      </main>
      <Footer />
    </div>
  );
}
