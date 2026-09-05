import type { AgentState, TranscriptEntry } from '@/types/conversation';

export interface AgentEventHandlers {
  onAgentStateChange?: (state: AgentState) => void;
  onAgentMessage?: (entry: TranscriptEntry) => void;
  onCustomerMessage?: (entry: TranscriptEntry) => void;
  onProspectUpdate?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export interface AgentControlMessage {
  type: 'interrupt' | 'update_instructions' | 'update_prospect' | 'escalate';
  payload?: Record<string, unknown>;
}
