import type { TranscriptEntry } from '@/types/conversation';

export type SimPhase =
  | 'intro'
  | 'company'
  | 'team'
  | 'usecase'
  | 'requirements'
  | 'pricing'
  | 'interest'
  | 'closing'
  | 'escalate'
  | 'done';

export interface SimTurn {
  phase: SimPhase;
  customerText: string;
  delayMs: number;
}

/**
 * A scripted but realistic conversation a customer might have with the
 * NexaVoice AI sales agent. Used in demo/simulation mode when real Agora
 * credentials are not configured.
 */
export const SIMULATION_SCRIPT: SimTurn[] = [
  {
    phase: 'intro',
    customerText: "Hi, I'm calling to learn more about NexaVoice. We're a SaaS company and I'm exploring AI sales tools.",
    delayMs: 2500,
  },
  {
    phase: 'company',
    customerText: "Sure, our company is called Brightwave Labs. We build analytics software for mid-market businesses.",
    delayMs: 3000,
  },
  {
    phase: 'team',
    customerText: "We have about 35 people, mostly in sales and customer success.",
    delayMs: 3000,
  },
  {
    phase: 'usecase',
    customerText: "We're mainly looking for lead qualification and inbound handling. Our sales team gets a lot of calls and we can't keep up.",
    delayMs: 3500,
  },
  {
    phase: 'requirements',
    customerText: "We'd need CRM integrations — we use HubSpot — and analytics reporting would be great. Human escalation is important too.",
    delayMs: 3500,
  },
  {
    phase: 'pricing',
    customerText: "What do your plans cost? We have a budget but I want to make sure it fits.",
    delayMs: 3000,
  },
  {
    phase: 'interest',
    customerText: "The Business plan sounds perfect for our team size. I'd love to get started — can we move forward?",
    delayMs: 3000,
  },
  {
    phase: 'closing',
    customerText: "That sounds great. My email is sarah@brightwavelabs.com. Looking forward to the follow-up!",
    delayMs: 3000,
  },
];

export interface SimEscalationScript {
  customerText: string;
  delayMs: number;
}

export const SIMULATION_ESCALATION: SimEscalationScript[] = [
  {
    customerText: "Actually, I'd like to speak to a human before making a decision.",
    delayMs: 2500,
  },
];

let idCounter = 0;
export function makeEntry(role: 'customer' | 'agent' | 'system', text: string): TranscriptEntry {
  return {
    id: `sim-${++idCounter}-${Date.now()}`,
    role,
    text,
    timestamp: Date.now(),
  };
}

export function resetSimCounter() {
  idCounter = 0;
}
