import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AgentState,
  ConversationStatus,
  ConversationSummary,
  ProspectInfo,
  TranscriptEntry,
} from '@/types/conversation';
import { emptyProspect, prospectFromPreCall, emptyFollowUp } from '@/types/conversation';
import type { PreCallProspect } from '@/data/precall';
import { applyProspectCorrections as detectCorrections } from '@/lib/conversation/corrections';
import { handleFollowUpTurn, followUpNextAction } from '@/lib/conversation/followUp';
import { persistConversation } from '@/lib/conversation/persist';
import { sendFollowUpEmail } from '@/lib/email/sendFollowUpEmail';
import { createRtcClient, type IAgoraRtcClient } from '@/lib/agora/rtcClient';
import { createAgentClient, type IAgoraAgentClient } from '@/lib/agora/agentClient';
import { fetchAgoraToken, isAgoraConfigured } from '@/lib/agora/config';
import { startRtmSession, type RtmSession } from '@/lib/agora/rtmClient';
import { attachConversationalToolkit } from '@/lib/agora/conversationalAi';
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

const BYE_PATTERN =
  /\b(bye|goodbye|bye-bye|see you|have a good day|that's all|that is all|that's everything|that will be all|no more questions|end the call|hang up)\b/i;

let entryId = 0;
let rtcUidCounter = 0;
function genId(): string {
  return `msg-${++entryId}-${Date.now()}`;
}

function generateBrowserRtcUid(): number {
  rtcUidCounter = (rtcUidCounter + 1) % 900000;
  return 100000 + ((Date.now() + rtcUidCounter) % 900000);
}

function findTranscriptEvent(
  value: unknown,
  inheritedRole?: 'customer' | 'agent',
): {
  text: string;
  role: 'customer' | 'agent';
  key: string;
} | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object') {
        return findTranscriptEvent(parsed, inheritedRole);
      }
    } catch {
      if (inheritedRole) {
        return { text: trimmed, role: inheritedRole, key: `${inheritedRole}:${trimmed}` };
      }
    }
    return null;
  }

  if (typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findTranscriptEvent(item, inheritedRole);
      if (found) return found;
    }
    return null;
  }

  const object = value as Record<string, unknown>;
  const objectType = typeof object.object === 'string' ? object.object : (typeof object.type === 'string' ? object.type : '');

  const roleText = [
    object.role,
    object.speaker,
    object.sender,
    object.participant_type,
    object.source,
    object.from,
    object.actor,
  ].find((entry): entry is string => typeof entry === 'string');

  const resolvedRole: 'customer' | 'agent' | undefined =
    object.is_customer === true ||
    object.is_user === true ||
    (roleText && /user|customer|human|remote|caller|input|client/i.test(roleText)) ||
    /user\.|customer\./i.test(objectType)
      ? 'customer'
      : object.is_agent === true ||
        object.is_assistant === true ||
        (roleText && /agent|assistant|bot|ai|emily|system/i.test(roleText)) ||
        /assistant\.|agent\./i.test(objectType)
        ? 'agent'
        : inheritedRole;

  const text = [
    object.text,
    object.message,
    object.transcript,
    object.content,
    object.text_content,
    object.words,
    object.delta,
  ].find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)?.trim();

  if (text && resolvedRole) {
    const turnId = object.turn_id ?? object.turn_seq_id ?? object.message_id ?? object.item_id ?? object.stream_id;
    const isFinal = object.is_final === true || object.final === true;
    const key = typeof turnId === 'string' || typeof turnId === 'number'
      ? `${resolvedRole}:${turnId}${isFinal ? ':final' : ''}`
      : `${resolvedRole}:${text.toLowerCase()}`;
    return { text, role: resolvedRole, key };
  }

  for (const [propKey, child] of Object.entries(object)) {
    if (child && typeof child === 'object') {
      const childRole = resolvedRole ?? (
        /user|customer/i.test(propKey) ? 'customer' :
        /agent|assistant/i.test(propKey) ? 'agent' : undefined
      );
      const nested = findTranscriptEvent(child, childRole);
      if (nested) return nested;
    }
  }

  return null;
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

export function useVoiceConversation(initialProspect?: PreCallProspect | null): UseVoiceConversationReturn {
  const createInitialProspect = useCallback((): ProspectInfo => {
    if (!initialProspect) return emptyProspect();
    const base = prospectFromPreCall(initialProspect);
    const plan = recommendPlan(base);
    if (plan) {
      base.recommendedPlan = plan.id;
      base.estimatedDealValue = plan.priceMonthly;
    }
    base.leadStatus = qualifyLead(base);
    return base;
  }, [initialProspect]);

  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [prospect, setProspect] = useState<ProspectInfo>(createInitialProspect);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isSimMode, setIsSimMode] = useState(false);

  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptKeysRef = useRef<Map<string, string>>(new Map());
  const processedCustomerEventsRef = useRef<Map<string, string>>(new Map());
  const rtcRef = useRef<IAgoraRtcClient | null>(null);
  const agentRef = useRef<IAgoraAgentClient | null>(null);
  const rtmRef = useRef<RtmSession | null>(null);
  const toolkitRef = useRef<{ unsubscribe(): void; destroy(): void } | null>(null);
  // The RTC data-stream fallback stays active until the toolkit has actually
  // delivered a real transcript event — a toolkit object existing is not proof
  // that events are arriving.
  const toolkitDeliveredRef = useRef(false);
  const prospectRef = useRef<ProspectInfo | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simIndexRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const simModeRef = useRef(false);
  const activeRef = useRef(false);
  const hasEndedRef = useRef(false);
  const isEndingRef = useRef(false);
  const emailDispatchedRef = useRef(false);
  const channelRef = useRef<string | null>(null);
  const silenceGenerationRef = useRef(0);
  const silenceCheckCountRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addEntry = useCallback((role: TranscriptEntry['role'], text: string, key?: string) => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const entry: TranscriptEntry = { id: genId(), role, text: trimmed, timestamp: Date.now() };
    setTranscript((prev) => {
      if (key) {
        const existingId = transcriptKeysRef.current.get(key);
        if (existingId) {
          const next = prev.map((item) => (item.id === existingId ? { ...item, text: trimmed } : item));
          transcriptRef.current = next;
          return next;
        }
        transcriptKeysRef.current.set(key, entry.id);
      }
      const next = [...prev, entry];
      transcriptRef.current = next;
      return next;
    });
    return entry;
  }, []);

  const updateProspect = useCallback(
    (customerText: string) => {
      setProspect((prev) => {
        // 1. Detect customer corrections
        const correction = detectCorrections(customerText, prev);
        const corrected = correction?.prospectPatch ? { ...prev, ...correction.prospectPatch } : prev;

        // 2. Parse customer message for requirements & plan interest
        const { prospectPatch, detectedPlanInterest } = parseCustomerMessage(customerText, corrected);
        let next = { ...corrected, ...prospectPatch };

        // 3. Detect follow-up requests
        const followUpResult = handleFollowUpTurn(customerText, next);
        if (followUpResult?.prospectPatch) {
          next = { ...next, ...followUpResult.prospectPatch };
        }

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

  const endInternal = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    isEndingRef.current = true;
    activeRef.current = false;

    if (simTimerRef.current) {
      clearTimeout(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (endingTimerRef.current) {
      clearTimeout(endingTimerRef.current);
      endingTimerRef.current = null;
    }

    setAgentState('idle');

    try {
      toolkitRef.current?.destroy();
      await agentRef.current?.stop();
      await rtcRef.current?.leave();
      await rtmRef.current?.logout();
    } catch {
      // best-effort cleanup
    }

    toolkitRef.current = null;
    toolkitDeliveredRef.current = false;
    rtmRef.current = null;
    rtcRef.current?.off();
    rtcRef.current?.destroy();
    rtcRef.current = null;
    agentRef.current?.off();
    agentRef.current = null;

    // Build summary & persist
    setProspect((finalProspect) => {
      const followUp = finalProspect.followUp ?? emptyFollowUp();
      const leadStatus = qualifyLead(finalProspect);
      const plan = recommendPlan(finalProspect);
      const dealValue = estimateDealValue(finalProspect);
      const endedAt = Date.now();
      const generatedNextAction = followUpNextAction(followUp) ?? nextAction(finalProspect, leadStatus);
      const hasFollowUp = Boolean(followUp.requestType && finalProspect.contactEmail?.trim());

      const summary: ConversationSummary = {
        startedAt: startedAtRef.current,
        endedAt,
        durationSeconds: Math.round((endedAt - startedAtRef.current) / 1000),
        transcript: transcriptRef.current,
        prospect: finalProspect,
        summaryText: buildSummary(finalProspect),
        customerRequirements: finalProspect.requirements,
        recommendedPlan: plan?.id ?? null,
        leadStatus,
        interestLevel: finalProspect.interestLevel,
        estimatedDealValue: dealValue,
        nextAction: generatedNextAction,
        escalationStatus: finalProspect.escalationStatus,
        followUp,
        persistStatus: 'failed',
        persistError: null,
        emailStatus: hasFollowUp ? 'sending' : 'skipped',
        emailError: null,
      };
      setSummary(summary);

      void persistConversation(channelRef.current, summary)
        .then(async () => {
          let emailStatus = summary.emailStatus;
          let emailError: string | null = null;

          if (hasFollowUp && !emailDispatchedRef.current) {
            emailDispatchedRef.current = true;
            try {
              const emailResult = await sendFollowUpEmail(summary, followUp);
              emailStatus = emailResult.status;
              emailError = emailResult.error;
            } catch (mailErr) {
              emailStatus = 'failed';
              emailError = mailErr instanceof Error ? mailErr.message : 'Failed to send confirmation email';
            }
          }

          setSummary((current) =>
            current
              ? {
                  ...current,
                  persistStatus: 'saved',
                  persistError: null,
                  emailStatus,
                  emailError,
                }
              : current,
          );
        })
        .catch((persistError: unknown) => {
          const errMsg = persistError instanceof Error ? persistError.message : 'Unable to save conversation lead';
          setError(errMsg);
          setSummary((current) =>
            current
              ? {
                  ...current,
                  persistStatus: 'failed',
                  persistError: errMsg,
                  emailStatus: hasFollowUp ? 'failed' : 'skipped',
                  emailError: hasFollowUp
                    ? 'The confirmation email was not sent because the conversation could not be saved first.'
                    : null,
                }
              : current,
          );
        });

      return finalProspect;
    });

    setStatus('ended');
  }, []);

  const cancelSilenceTimers = useCallback(() => {
    silenceGenerationRef.current += 1;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (endingTimerRef.current) {
      clearTimeout(endingTimerRef.current);
      endingTimerRef.current = null;
    }
  }, []);

  const handleCustomerGoodbye = useCallback(() => {
    if (hasEndedRef.current) return;
    cancelSilenceTimers();
    isEndingRef.current = true;

    const followUp = prospectRef.current?.followUp;
    let closingMsg = 'Thank you for your time. Have a great day!';
    if (followUp?.requestType === 'demo') {
      closingMsg = "Thank you for your time. I've noted your demo follow-up request. Have a wonderful day!";
    } else if (followUp?.requestType === 'human') {
      closingMsg = "Thank you for speaking with me. I've noted your request for our sales team to follow up. Have a great day!";
    }

    addEntry('agent', closingMsg);
    setAgentState('speaking');

    agentRef.current?.sendControl({
      type: 'update_instructions',
      payload: { instruction: `The customer said goodbye. Say: "${closingMsg}" and conclude.` },
    });

    endingTimerRef.current = setTimeout(() => {
      endingTimerRef.current = null;
      void endInternal();
    }, 1800);
  }, [cancelSilenceTimers, addEntry, endInternal]);

  const scheduleSilenceCheck = useCallback(() => {
    cancelSilenceTimers();
    if (!activeRef.current || isEndingRef.current || hasEndedRef.current) return;

    const currentGen = silenceGenerationRef.current;
    silenceTimerRef.current = setTimeout(() => {
      if (currentGen !== silenceGenerationRef.current) return;
      if (!activeRef.current || isEndingRef.current || hasEndedRef.current) return;

      if (silenceCheckCountRef.current === 0) {
        silenceCheckCountRef.current = 1;
        const msg = "I can't hear you. Are you there?";
        addEntry('agent', msg);
        setAgentState('speaking');

        agentRef.current?.sendControl({
          type: 'update_instructions',
          payload: { instruction: 'The customer has been silent. Ask: "I can\'t hear you. Are you there?" and wait for a response.' },
        });

        silenceTimerRef.current = setTimeout(() => {
          if (currentGen !== silenceGenerationRef.current) return;
          if (!activeRef.current || isEndingRef.current || hasEndedRef.current) return;

          silenceCheckCountRef.current = 2;
          isEndingRef.current = true;
          const closingMsg = "I guess you're not here. Thank you for your time.";
          addEntry('agent', closingMsg);
          setAgentState('speaking');

          agentRef.current?.sendControl({
            type: 'update_instructions',
            payload: { instruction: 'The customer is still silent. Say: "I guess you\'re not here. Thank you for your time." and conclude.' },
          });

          endingTimerRef.current = setTimeout(() => {
            if (currentGen !== silenceGenerationRef.current) return;
            endingTimerRef.current = null;
            void endInternal();
          }, 2000);
        }, 12000);
      }
    }, 15000);
  }, [cancelSilenceTimers, addEntry, endInternal]);

  /**
   * Single ingestion point for live conversation events (customer + agent).
   * Used by the Conversational AI toolkit (RTM data channel) and the RTC data
   * stream fallback so there is exactly one transcript/prospect/silence flow.
   */
  const ingestTranscriptEvent = useCallback(
    (role: TranscriptEntry['role'], text: string, key?: string) => {
      if (role !== 'customer') {
        addEntry('agent', text, key);
        return;
      }

      // Temporary diagnostics for one live call.
      console.log('[Live] customer transcript →', { text, key });

      // Only a genuinely new/changed customer speech event is treated as real
      // speech: it reconciles the transcript and resets the silence state. Replayed
      // history items (same key + text) never reset silence or re-extract facts.
      const isNewOrChanged =
        !key || processedCustomerEventsRef.current.get(key) !== text;

      addEntry('customer', text, key);
      if (!isNewOrChanged) return;
      if (key) processedCustomerEventsRef.current.set(key, text);

      cancelSilenceTimers();
      silenceCheckCountRef.current = 0;
      isEndingRef.current = false;
      updateProspect(text);
      console.log('[Silence] reset — real customer speech', { text, key });

      if (BYE_PATTERN.test(text)) {
        handleCustomerGoodbye();
        return;
      }

      scheduleSilenceCheck();
    },
    [cancelSilenceTimers, addEntry, updateProspect, scheduleSilenceCheck, handleCustomerGoodbye],
  );

  const processCustomerMessage = useCallback(
    (text: string) => {
      cancelSilenceTimers();
      silenceCheckCountRef.current = 0;
      isEndingRef.current = false;

      addEntry('customer', text);
      updateProspect(text);

      if (BYE_PATTERN.test(text)) {
        handleCustomerGoodbye();
        return;
      }

      scheduleSilenceCheck();

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
    [cancelSilenceTimers, addEntry, updateProspect, handleCustomerGoodbye, scheduleSilenceCheck],
  );

  const handleLiveMessage = useCallback(
    (data: string) => {
      // Fallback path: only disabled once the toolkit has actually delivered a
      // real transcript event (keyed reconciliation prevents double-processing
      // when both channels carry the same content).
      if (toolkitDeliveredRef.current) return;
      try {
        const raw = JSON.parse(data) as Record<string, unknown>;
        const event = findTranscriptEvent(raw);
        if (!event) return;
        console.log('[Stream] fallback message →', event);
        ingestTranscriptEvent(event.role, event.text, event.key);
      } catch {
        return;
      }
    },
    [ingestTranscriptEvent],
  );

  const runSimulation = useCallback(() => {
    if (!activeRef.current) return;

    const idx = simIndexRef.current;
    if (idx >= SIMULATION_SCRIPT.length) {
      simTimerRef.current = setTimeout(() => {
        if (activeRef.current) {
          void endInternal();
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
  }, [processCustomerMessage, endInternal]);

  const start = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;
    setError(null);
    setSummary(null);
    setStatus('connecting');
    setAgentState('idle');
    setTranscript([]);
    transcriptRef.current = [];
    transcriptKeysRef.current.clear();
    processedCustomerEventsRef.current.clear();
    setProspect(createInitialProspect());
    cancelSilenceTimers();
    silenceCheckCountRef.current = 0;
    toolkitDeliveredRef.current = false;
    resetSimCounter();
    entryId = 0;
    activeRef.current = true;
    hasEndedRef.current = false;
    isEndingRef.current = false;
    emailDispatchedRef.current = false;
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
      const agent = await createAgentClient(channelName, browserUid, (data) => {
        rtcRef.current?.sendStreamMessage(data);
      });
      agentRef.current = agent;

      agent.on({
        onAgentStateChange: (state) => setAgentState(state),
        onAgentMessage: (entry) => addEntry('agent', entry.text),
        onCustomerMessage: (entry) => ingestTranscriptEvent('customer', entry.text),
        onError: (message) => setError(message),
      });
      rtc.on({
        onStreamMessage: (_uid, data) => {
          handleLiveMessage(data);
        },
      });

      const token = await fetchAgoraToken(channelName, browserUid);
      if (!token) throw new Error('Agora is not configured');
      await rtc.join(token);

      // The agent is started with data_channel "rtm" (enable_rtm), so live
      // transcript and agent-state events are delivered over Signaling. Use the
      // existing Conversational AI toolkit + RTM session to receive them.
      const rtm = await startRtmSession(token.appId, String(token.uid), token.rtmToken ?? token.token, channelName);
      rtmRef.current = rtm;

      const toolkit = await attachConversationalToolkit({
        rtcEngine: rtc.getRawClient?.() ?? null,
        rtmEngine: rtm?.engine,
        channelName,
        onTranscript: (entry) => {
          // First real event from the authoritative path disables the fallback.
          toolkitDeliveredRef.current = true;
          ingestTranscriptEvent(entry.role, entry.text, entry.key);
        },
        onAgentState: (state) => {
          console.log('[Live] agent state →', state);
          setAgentState(state);
        },
        onError: (message) => setError(message),
      });
      toolkitRef.current = toolkit;

      await agent.start();

      setStatus('connected');
      setAgentState('listening');
      scheduleSilenceCheck();

      // The live agent owns its greeting; the local greeting is only for demo mode.
      setTimeout(() => {
        if (simModeRef.current) {
          addEntry('agent', greetingMessage());
          setAgentState('listening');
          simIndexRef.current = 0;
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
      try {
        await agentRef.current?.stop();
        await rtcRef.current?.leave();
        await rtmRef.current?.logout();
        toolkitRef.current?.destroy();
      } catch {
        // Best-effort cleanup after a failed start.
      }
    }
  }, [status, addEntry, handleLiveMessage, runSimulation, createInitialProspect, ingestTranscriptEvent, cancelSilenceTimers, scheduleSilenceCheck]);

  const end = useCallback(async () => {
    await endInternal();
  }, [endInternal]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        rtcRef.current?.muteLocalAudio();
        cancelSilenceTimers();
      } else {
        rtcRef.current?.unmuteLocalAudio();
        silenceCheckCountRef.current = 0;
        scheduleSilenceCheck();
      }
      return next;
    });
  }, [cancelSilenceTimers, scheduleSilenceCheck]);

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
    prospectRef.current = prospect;
  }, [prospect]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      cancelSilenceTimers();
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      rtcRef.current?.off();
      rtcRef.current?.destroy();
      agentRef.current?.off();
      toolkitRef.current?.destroy();
      void rtmRef.current?.logout();
    };
  }, [cancelSilenceTimers]);

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
