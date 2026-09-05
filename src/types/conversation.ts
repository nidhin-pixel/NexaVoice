import type { ProductPlanId } from '@/data/products';

export type ConversationRole = 'customer' | 'agent' | 'system';

export interface TranscriptEntry {
  id: string;
  role: ConversationRole;
  text: string;
  timestamp: number;
}

export type LeadStatus = 'new' | 'discovering' | 'qualified' | 'unqualified' | 'escalated';
export type InterestLevel = 'unknown' | 'low' | 'medium' | 'high';
export type EscalationStatus = 'none' | 'requested' | 'in_progress' | 'completed';
export type ConversationStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';
export type AgentState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface ProspectInfo {
  company: string | null;
  contactName: string | null;
  contactEmail: string | null;
  teamSize: string | null;
  useCase: string | null;
  requirements: string[];
  interestLevel: InterestLevel;
  recommendedPlan: ProductPlanId | null;
  estimatedDealValue: number | null;
  leadStatus: LeadStatus;
  escalationStatus: EscalationStatus;
  notes: string[];
}

export function emptyProspect(): ProspectInfo {
  return {
    company: null,
    contactName: null,
    contactEmail: null,
    teamSize: null,
    useCase: null,
    requirements: [],
    interestLevel: 'unknown',
    recommendedPlan: null,
    estimatedDealValue: null,
    leadStatus: 'new',
    escalationStatus: 'none',
    notes: [],
  };
}

export interface ConversationSummary {
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  transcript: TranscriptEntry[];
  prospect: ProspectInfo;
  summaryText: string;
  customerRequirements: string[];
  recommendedPlan: ProductPlanId | null;
  leadStatus: LeadStatus;
  interestLevel: InterestLevel;
  estimatedDealValue: number | null;
  nextAction: string;
  escalationStatus: EscalationStatus;
}

export interface AgoraConfig {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
}
