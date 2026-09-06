import type { ProductPlanId } from '@/data/products';
import type { TeamSizeOption } from '@/data/precall';

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
export type FollowUpRequestType = 'demo' | 'human';
export type ProspectField = 'name' | 'email' | 'company' | 'teamSize';
export type EmailDeliveryStatus = 'idle' | 'sending' | 'sent' | 'failed' | 'not_configured' | 'skipped';

export interface FollowUpRequest {
  requestType: FollowUpRequestType | null;
  preferredDate: string | null;
  preferredTime: string | null;
  timezone: string | null;
  confirmed: boolean;
  rawText: string | null;
}

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
  nameCorrectionCount: number;
  emailCorrectionCount: number;
  companyCorrectionCount: number;
  teamSizeCorrectionCount: number;
  pendingConfirmationField: ProspectField | null;
  pendingConfirmationValue: string | null;
  followUp: FollowUpRequest;
}

export function emptyFollowUp(): FollowUpRequest {
  return {
    requestType: null,
    preferredDate: null,
    preferredTime: null,
    timezone: null,
    confirmed: false,
    rawText: null,
  };
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
    nameCorrectionCount: 0,
    emailCorrectionCount: 0,
    companyCorrectionCount: 0,
    teamSizeCorrectionCount: 0,
    pendingConfirmationField: null,
    pendingConfirmationValue: null,
    followUp: emptyFollowUp(),
  };
}

export function prospectFromPreCall(input: {
  contactName: string;
  contactEmail: string;
  company: string;
  teamSize: TeamSizeOption | string;
}): ProspectInfo {
  return {
    ...emptyProspect(),
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    company: input.company,
    teamSize: input.teamSize,
    leadStatus: 'discovering',
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
  followUp: FollowUpRequest;
  persistStatus: 'saved' | 'failed';
  persistError: string | null;
  emailStatus: EmailDeliveryStatus;
  emailError: string | null;
}

export interface AgoraConfig {
  appId: string;
  channelName: string;
  token: string;
  rtmToken?: string;
  uid: number;
}
