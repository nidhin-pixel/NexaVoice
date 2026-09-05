import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentState,
  ConversationStatus,
  ConversationSummary,
  ProspectInfo,
  TranscriptEntry,
} from '@/types/conversation';
import { emptyProspect } from '@/types/conversation';
import { createRtcClient, type IAgoraRtcClient } from '@/lib/agora/rtcClient';
import { createAgentClient, type IAgoraAgentClient } from '@/lib/agora/agentClient';
import { fetchAgoraToken, isAgoraConfigured } from '@/lib/agora/config';
import { supabase } from '@/lib/supabaseClient';
import {
  parseCustomerMessage,
  recommendPlan,
  qualifyLead,
  estimateDealValue,
  buildSummary,
  nextAction,
} from '@/lib/conversation/engine';
import {
  detectPhase,
  generateAgentResponse,
  greetingMessage,
} from '@/lib/conversation/agentResponse';
import {
  SIMULATION_SCRIPT,
  resetSimCounter,
} from '@/lib/conversation/simulation';

let entryId = 0;
let rtcUidCounter = 0;
function genId(): string {
  return `msg-${++entryId}-${Date.now()}`;
}

function generateBrowserRtcUid(): number {
  rtcUidCounter = (rtcUidCounter + 1) % 900000;
  return 100000 + ((Date.now() + rtcUidCounter) % 900000);
}

export interface UseVoiceConversationReturn {
  status: ConversationStatus;
  agentState: AgentState;
  transcript: TranscriptEntry[];
  prospect: ProspectInfo;
  isMuted: boolean;
  isSimMode: boolean;
  error: string | null;
  summary: ConversationSummary | null;
  start: () => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
  escalate: () => void;
  injectCustomerMessage: (text: string) => void;
}

export function useVoiceConversation(): UseVoiceConversationReturn {
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [prospect, setProspect] = useState<ProspectInfo>(emptyProspect());
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isSimMode, setIsSimMode] = useState(false);

  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const rtcRef = useRef<IAgoraRtcClient | null>(null);
  const agentRef = useRef<IAgoraAgentClient | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIndexRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const simModeRef = useRef(false);
  const activeRef = useRef(false);
  const channelRef = useRef<string | null>(null);

  const addEntry = useCallback((role: TranscriptEntry['role'], text: string) => {
    const entry: TranscriptEntry = { id: genId(), role, text, timestamp: Date.now() };
    setTranscript((prev) => {
      const next = [...prev, entry];
      transcriptRef.current = next;
      return next;
    });
    return entry;
  }, []);

  const updateProspect = useCallback(
    (customerText: string) => {
      setProspect((prev) => {
        const { prospectPatch, detectedPlanInterest } = parseCustomerMessage(customerText, prev);
        const next = { ...prev, ...prospectPatch };

        // Re-evaluate recommendation and qualification
        const plan = recommendPlan(next);
        if (plan) {
          next.recommendedPlan = plan.id;
          next.estimatedDealValue = plan.priceMonthly;
        }
        next.leadStatus = qualifyLead(next);

        // If plan interest detected and no recommendation yet, note it
        if (detectedPlanInterest && !next.recommendedPlan) {
          next.recommendedPlan = detectedPlanInterest;
          const p = plan;
          if (p) next.estimatedDealValue = p.priceMonthly;
        }

        return next;
      });
    },
    [],
  );

  const processCustomerMessage = useCallback(
    (text: string) => {
      addEntry('customer', text);
      updateProspect(text);

      // Agent thinks then responds
      setAgentState('thinking');

      setTimeout(() => {
        setProspect((currentProspect) => {
          const phase = detectPhase(text, currentProspect);
          const response = generateAgentResponse(text, currentProspect, phase);
          setAgentState('speaking');
          addEntry('agent', response);

          // After speaking, go back to listening
          setTimeout(() => {
            setAgentState((s) => (s === 'speaking' ? 'listening' : s));
          }, 2000);

          return currentProspect;
        });
      }, 800);
    },
    [addEntry, updateProspect],
  );

  const runSimulation = useCallback(() => {
    if (!activeRef.current) return;

    const idx = simIndexRef.current;
    if (idx >= SIMULATION_SCRIPT.length) {
      // Conversation complete — auto-end after a pause
      simTimerRef.current = setTimeout(() => {
        if (activeRef.current) {
          endInternal();
        }
      }, 4000);
      return;
    }

    const turn = SIMULATION_SCRIPT[idx];
    simIndexRef.current += 1;

    simTimerRef.current = setTimeout(() => {
      if (!activeRef.current) return;
      processCustomerMessage(turn.customerText);
      runSimulation();
    }, turn.delayMs);
  }, [processCustomerMessage]);

  const start = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;
    setError(null);
    setSummary(null);
    setStatus('connecting');
    setAgentState('idle');
    setTranscript([]);
    transcriptRef.current = [];
    setProspect(emptyProspect());
    resetSimCounter();
    entryId = 0;
    activeRef.current = true;
    startedAtRef.current = Date.now();

    const configured = isAgoraConfigured();
    setIsSimMode(!configured);
    simModeRef.current = !configured;

    try {
      const rtc = await createRtcClient();
      rtcRef.current = rtc;

      const channelName = `nexavoice-${Date.now()}`;
      channelRef.current = channelName;
      const browserUid = generateBrowserRtcUid();
      const agent = await createAgentClient(channelName, browserUid);
      agentRef.current = agent;

      agent.on({
        onAgentStateChange: (state) => setAgentState(state),
        onAgentMessage: (entry) => addEntry('agent', entry.text),
        onCustomerMessage: (entry) => {
          addEntry('customer', entry.text);
          updateProspect(entry.text);
        },
        onError: (message) => setError(message),
      });
      rtc.on({
        onStreamMessage: (_uid, data) => {
          try {
            const event = JSON.parse(data) as {
              type?: string;
              role?: 'agent' | 'customer';
              text?: string;
              message?: string;
            };
            const text = event.text ?? event.message;
            if (!text || (event.type !== 'transcript' && !event.role)) return;
            if (event.role === 'customer') {
              addEntry('customer', text);
              updateProspect(text);
            } else addEntry('agent', text);
          } catch {
            // Ignore non-JSON data stream messages.
          }
        },
      });

      const token = await fetchAgoraToken(channelName, browserUid);
      if (!token) throw new Error('Agora is not configured');
      await rtc.join(token);

      await agent.start();

      setStatus('connected');
      setAgentState('listening');

      // The live agent owns its greeting; the local greeting is only for demo mode.
      setTimeout(() => {
        if (simModeRef.current) {
          addEntry('agent', greetingMessage());
          setAgentState('listening');
          simIndexRef.current = 0;
          // Start simulation after greeting
          simTimerRef.current = setTimeout(() => {
            runSimulation();
          }, 3000);
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(msg);
      setStatus('error');
      activeRef.current = false;
    }
  }, [status, addEntry, runSimulation, updateProspect]);

  const endInternal = useCallback(async () => {
    activeRef.current = false;
    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }

    setAgentState('idle');

    try {
      await agentRef.current?.stop();
      await rtcRef.current?.leave();
    } catch {
      // best-effort cleanup
    }

    rtcRef.current?.off();
    rtcRef.current?.destroy();
    rtcRef.current = null;
    agentRef.current?.off();
    agentRef.current = null;

    // Build summary
    setProspect((finalProspect) => {
      const leadStatus = qualifyLead(finalProspect);
      const plan = recommendPlan(finalProspect);
      const dealValue = estimateDealValue(finalProspect);
      const endedAt = Date.now();
      const summary: ConversationSummary = {
        startedAt: startedAtRef.current,
        endedAt,
        durationSeconds: Math.round((endedAt - startedAtRef.current) / 1000),
        transcript: [],
        prospect: finalProspect,
        summaryText: buildSummary(finalProspect),
        customerRequirements: finalProspect.requirements,
        recommendedPlan: plan?.id ?? null,
        leadStatus,
        interestLevel: finalProspect.interestLevel,
        estimatedDealValue: dealValue,
        nextAction: nextAction(finalProspect, leadStatus),
        escalationStatus: finalProspect.escalationStatus,
      };
      setSummary(summary);
      void supabase.from('conversations').insert({
        channel_name: channelRef.current,
        started_at: new Date(summary.startedAt).toISOString(),
        ended_at: new Date(summary.endedAt).toISOString(),
        duration_seconds: summary.durationSeconds,
        transcript: transcriptRef.current,
        prospect: summary.prospect,
        summary_text: summary.summaryText,
        customer_requirements: summary.customerRequirements,
        recommended_plan: summary.recommendedPlan,
        lead_status: summary.leadStatus,
        interest_level: summary.interestLevel,
        estimated_deal_value: summary.estimatedDealValue,
        next_action: summary.nextAction,
        escalation_status: summary.escalationStatus,
      });
      return finalProspect;
    });

    setStatus('ended');
  }, []);

  const end = useCallback(async () => {
    await endInternal();
  }, [endInternal]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      rtcRef.current?.[next ? 'muteLocalAudio' : 'unmuteLocalAudio']();
      return next;
    });
  }, []);

  const escalate = useCallback(() => {
    setProspect((prev) => ({
      ...prev,
      escalationStatus: 'requested',
      leadStatus: 'escalated',
    }));
    addEntry('system', 'Human assistance requested. Routing to a sales representative...');
    setAgentState('speaking');
    setTimeout(() => {
      addEntry(
        'agent',
        "I understand you'd like to speak with a human team member. I'm connecting you now — everything we've discussed will be shared with them so you don't have to repeat anything.",
      );
      setAgentState('listening');
    }, 1000);
  }, [addEntry]);

  const injectCustomerMessage = useCallback(
    (text: string) => {
      if (status !== 'connected') return;
      processCustomerMessage(text);
    },
    [status, processCustomerMessage],
  );

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      rtcRef.current?.off();
      rtcRef.current?.destroy();
      agentRef.current?.off();
    };
  }, []);

  return {
    status,
    agentState,
    transcript,
    prospect,
    isMuted,
    isSimMode,
    error,
    summary,
    start,
    end,
    toggleMute,
    escalate,
    injectCustomerMessage,
  };
}
