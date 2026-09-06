import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AgentState,
  ConversationStatus,
  ConversationSummary,
  ProspectInfo,
  TranscriptEntry,
} from '@/types/conversation';

import { emptyFollowUp, emptyProspect, prospectFromPreCall } from '@/types/conversation';
import type { PreCallProspect } from '@/data/precall';

import {
  createRtcClient,
  type IAgoraRtcClient,
} from '@/lib/agora/rtcClient';

import {
  createAgentClient,
  type IAgoraAgentClient,
} from '@/lib/agora/agentClient';

import {
  fetchAgoraToken,
  isAgoraConfigured,
} from '@/lib/agora/config';

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

import { applyProspectCorrections } from '@/lib/conversation/corrections';
import { followUpNextAction, handleFollowUpTurn } from '@/lib/conversation/followUp';
import { buildEmilySessionInstruction } from '@/lib/conversation/emilyInstructions';
import { mapConversationError, mapPersistError } from '@/lib/conversation/mapError';
import { persistConversation } from '@/lib/conversation/persist';
import { sendFollowUpEmail } from '@/lib/email/sendFollowUpEmail';

let entryId = 0;
let rtcUidCounter = 0;

function genId(): string {
  return `msg-${++entryId}-${Date.now()}`;
}

function generateBrowserRtcUid(): number {
  rtcUidCounter = (rtcUidCounter + 1) % 900000;
  return 100000 + ((Date.now() + rtcUidCounter) % 900000);
}

function findTranscriptEvent(value: unknown): {
  text: string;
  role: 'customer' | 'agent';
  key: string;
} | null {
  if (typeof value === 'string') {
    try {
      return findTranscriptEvent(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const object = value as Record<string, unknown>;
  const objectType = typeof object.object === 'string' ? object.object : '';
  const typeText = `${objectType} ${typeof object.type === 'string' ? object.type : ''}`;
  const roleText = [
    object.role,
    object.speaker,
    object.sender,
    object.participant_type,
    object.source,
  ].find((entry): entry is string => typeof entry === 'string');

  const text = [
    object.text,
    object.message,
    object.transcript,
    object.content,
    object.text_content,
  ]
    .find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    ?.trim();

  if (
    text &&
    (/transcription|transcript/i.test(typeText) ||
      Boolean(roleText) ||
      object.is_customer === true ||
      object.is_user === true)
  ) {
    const isCustomer =
      object.is_customer === true ||
      object.is_user === true ||
      /user|customer|human|remote|caller|input/i.test(roleText ?? '') ||
      /user\./i.test(typeText);

    const turnId = object.turn_id ?? object.turn_seq_id;
    const key =
      typeof turnId === 'string' || typeof turnId === 'number'
        ? `${typeText}:${turnId}`
        : `${typeText}:${text.toLowerCase()}`;

    return {
      text,
      role: isCustomer ? 'customer' : 'agent',
      key,
    };
  }

  for (const child of Object.values(object)) {
    const nested = findTranscriptEvent(child);
    if (nested) return nested;
  }

  return null;
}

function applyIntelligence(base: ProspectInfo): ProspectInfo {
  const next = { ...base };
  const plan = recommendPlan(next);
  if (plan) {
    next.recommendedPlan = plan.id;
    next.estimatedDealValue = plan.priceMonthly;
  }
  next.leadStatus = qualifyLead(next);
  return next;
}

export interface UseVoiceConversationReturn {
  status: ConversationStatus;
  agentState: AgentState;
  transcript: TranscriptEntry[];
  prospect: ProspectInfo;
  isMuted: boolean;
  error: string | null;
  summary: ConversationSummary | null;
  start: (preCall: PreCallProspect) => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
  escalate: (type?: 'demo' | 'human') => void;
}

export function useVoiceConversation(): UseVoiceConversationReturn {
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [agentState, setAgentState] = useState<AgentState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [prospect, setProspect] = useState<ProspectInfo>(emptyProspect());
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);

  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptKeysRef = useRef<Map<string, string>>(new Map());
  const processedCustomerEventsRef = useRef<Map<string, string>>(new Map());
  const rtcRef = useRef<IAgoraRtcClient | null>(null);
  const agentRef = useRef<IAgoraAgentClient | null>(null);
  const rtmRef = useRef<RtmSession | null>(null);
  const toolkitRef = useRef<{ unsubscribe(): void; destroy(): void } | null>(null);
  const startedAtRef = useRef<number>(0);
  const activeRef = useRef(false);
  const channelRef = useRef<string | null>(null);
  const prospectRef = useRef<ProspectInfo>(emptyProspect());
  const toolkitActiveRef = useRef(false);
  const endingPromptCountRef = useRef(0);
  const silencePromptCountRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSilenceCheckRef = useRef<() => void>(() => undefined);

  const addEntry = useCallback((role: TranscriptEntry['role'], text: string, key?: string) => {
    const entry: TranscriptEntry = {
      id: genId(),
      role,
      text,
      timestamp: Date.now(),
    };

    setTranscript((prev) => {
      if (key) {
        const existingId = transcriptKeysRef.current.get(key);
        if (existingId) {
          const next = prev.map((item) => (item.id === existingId ? { ...item, text } : item));
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

  const sendInstruction = useCallback((instruction: string) => {
    agentRef.current?.sendControl({
      type: 'update_instructions',
      payload: { instruction },
    });
  }, []);

  const consumeCustomerText = useCallback(
    (text: string) => {
      const prev = prospectRef.current;
      silencePromptCountRef.current = 0;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (endingTimerRef.current) {
        clearTimeout(endingTimerRef.current);
        endingTimerRef.current = null;
      }
      const correction = applyProspectCorrections(text, prev);
      let next: ProspectInfo = { ...prev, ...(correction?.prospectPatch ?? {}) };

      const parsed = parseCustomerMessage(text, next);
      next = { ...next, ...parsed.prospectPatch };

      const followUp = handleFollowUpTurn(text, next);
      if (followUp?.prospectPatch) {
        next = { ...next, ...followUp.prospectPatch };
      }

      next = applyIntelligence(next);
      prospectRef.current = next;
      setProspect(next);

      if (correction?.instruction) sendInstruction(correction.instruction);
      if (correction?.systemNote) addEntry('system', correction.systemNote);

      if (followUp?.instruction) sendInstruction(followUp.instruction);
      if (followUp?.systemNote) addEntry('system', followUp.systemNote);
    },
    [addEntry, sendInstruction],
  );

  const handleLiveMessage = useCallback(
    (data: string) => {
      if (toolkitActiveRef.current) return;

      try {
        const raw = JSON.parse(data) as Record<string, unknown>;
        const event = findTranscriptEvent(raw);
        if (!event) return;

        const { text, role, key } = event;
        addEntry(role, text, key);

        if (role !== 'customer') {
          scheduleSilenceCheckRef.current();
          return;
        }
        if (processedCustomerEventsRef.current.get(key) === text) return;
        processedCustomerEventsRef.current.set(key, text);
        consumeCustomerText(text);
      } catch {
        return;
      }
    },
    [addEntry, consumeCustomerText],
  );

  const start = useCallback(
    async (preCall: PreCallProspect) => {
      if (status === 'connecting' || status === 'connected') return;

      if (!isAgoraConfigured()) {
        setError(
          'Live voice is not configured. Add VITE_AGORA_APP_ID and VITE_SUPABASE_URL, then reload.',
        );
        setStatus('error');
        return;
      }

      const initialProspect = prospectFromPreCall(preCall);
      setError(null);
      setSummary(null);
      setStatus('connecting');
      setAgentState('idle');
      setTranscript([]);
      transcriptRef.current = [];
      transcriptKeysRef.current.clear();
      processedCustomerEventsRef.current.clear();
      prospectRef.current = initialProspect;
      setProspect(initialProspect);
      endingPromptCountRef.current = 0;
      silencePromptCountRef.current = 0;
      toolkitActiveRef.current = false;
      entryId = 0;
      activeRef.current = true;
      startedAtRef.current = Date.now();

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
          onAgentMessage: (entry) => {
            addEntry('agent', entry.text);
            scheduleSilenceCheckRef.current();
          },
          onCustomerMessage: (entry) => {
            addEntry('customer', entry.text);
            consumeCustomerText(entry.text);
          },
          onError: (message) => setError(message),
        });

        rtc.on({
          onStreamMessage: (_uid, data) => handleLiveMessage(data),
          onConnectionStateChanged: (state) => {
            if (activeRef.current && /DISCONNECTED|DISCONNECTING|FAILED/i.test(state)) {
              setError('The live voice connection was interrupted. You can end the call and try again.');
            }
          },
        });

        const token = await fetchAgoraToken(channelName, browserUid);
        if (!token) {
          throw new Error('Agora is not configured');
        }

        await rtc.join(token);

        const rtm = await startRtmSession(token.appId, String(token.uid), token.rtmToken ?? token.token);
        rtmRef.current = rtm;

        const toolkit = await attachConversationalToolkit({
          rtcEngine: rtc.getRawClient?.() ?? null,
          rtmEngine: rtm?.engine,
          channelName,
          onTranscript: ({ role, text, key }) => {
            addEntry(role, text, key);
            if (role !== 'customer') {
              scheduleSilenceCheckRef.current();
              return;
            }
            if (processedCustomerEventsRef.current.get(key) === text) return;
            processedCustomerEventsRef.current.set(key, text);
            consumeCustomerText(text);
          },
          onAgentState: setAgentState,
          onError: setError,
        });

        toolkitRef.current = toolkit;
        toolkitActiveRef.current = Boolean(toolkit);

        await agent.start();
        sendInstruction(buildEmilySessionInstruction(initialProspect));
        agent.sendControl({
          type: 'update_prospect',
          payload: {
            contactName: initialProspect.contactName,
            contactEmail: initialProspect.contactEmail,
            company: initialProspect.company,
            teamSize: initialProspect.teamSize,
          },
        });

        setStatus('connected');
        setAgentState('listening');
      } catch (err) {
        setError(mapConversationError(err));
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
    },
    [status, addEntry, consumeCustomerText, handleLiveMessage, sendInstruction],
  );

  const endInternal = useCallback(async () => {
    activeRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (endingTimerRef.current) clearTimeout(endingTimerRef.current);
    silenceTimerRef.current = null;
    endingTimerRef.current = null;
    setAgentState('idle');

    try {
      toolkitRef.current?.destroy();
      await agentRef.current?.stop();
      await rtcRef.current?.leave();
      await rtmRef.current?.logout();
    } catch {
      // Best-effort cleanup.
    }

    rtcRef.current?.off();
    rtcRef.current?.destroy();
    rtcRef.current = null;
    agentRef.current?.off();
    agentRef.current = null;
    rtmRef.current = null;
    toolkitRef.current = null;
    toolkitActiveRef.current = false;

    const finalProspect = applyIntelligence(prospectRef.current);
    prospectRef.current = finalProspect;
    const followUp = finalProspect.followUp ?? emptyFollowUp();
    const leadStatus = qualifyLead(finalProspect);
    const plan = recommendPlan(finalProspect);
    const dealValue = estimateDealValue(finalProspect);
    const endedAt = Date.now();
    const generatedNextAction =
      followUpNextAction(followUp) ?? nextAction(finalProspect, leadStatus);

    const conversationSummary: ConversationSummary = {
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
      emailStatus: followUp.requestType ? 'sending' : 'skipped',
      emailError: null,
    };

    setProspect(finalProspect);
    setSummary(conversationSummary);
    setStatus('ended');

    void persistConversation(channelRef.current, conversationSummary)
      .then(async () => {
        let emailStatus = conversationSummary.emailStatus;
        let emailError: string | null = null;
        if (followUp.requestType) {
          const email = await sendFollowUpEmail(conversationSummary, followUp);
          emailStatus = email.status;
          emailError = email.error;
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
        const message = mapPersistError(persistError);
        setError(message);
        setSummary((current) =>
          current
            ? {
                ...current,
                persistStatus: 'failed',
                persistError: message,
                emailStatus: followUp.requestType ? 'failed' : 'skipped',
                emailError: followUp.requestType
                  ? 'The confirmation email was not sent because the conversation could not be saved first.'
                  : null,
              }
            : current,
        );
      });
  }, []);

  const end = useCallback(async () => {
    await endInternal();
  }, [endInternal]);

  const scheduleSilenceCheck = useCallback(() => {
    if (!activeRef.current || silencePromptCountRef.current >= 3) return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (!activeRef.current) return;

      silencePromptCountRef.current += 1;
      const check = silencePromptCountRef.current;
      sendInstruction(
        check === 1
          ? 'The customer has been quiet. Give one brief, natural check-in, then wait for a response.'
          : check === 2
            ? 'The customer is still quiet. Ask one brief check-in question, then wait for a response.'
            : 'Give one final polite check-in. If there is still no response, end the conversation gracefully.',
      );

      if (check < 3) {
        scheduleSilenceCheck();
      } else {
        endingTimerRef.current = setTimeout(() => {
          endingTimerRef.current = null;
          void endInternal();
        }, 12000);
      }
    }, 12000);
  }, [endInternal, sendInstruction]);

  scheduleSilenceCheckRef.current = scheduleSilenceCheck;

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) rtcRef.current?.muteLocalAudio();
      else rtcRef.current?.unmuteLocalAudio();

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      silencePromptCountRef.current = 0;

      return next;
    });
  }, []);

  const escalate = useCallback(
    (type: 'demo' | 'human' = 'human') => {
      const followUp = handleFollowUpTurn(
        type === 'demo' ? 'I want to schedule a demo' : 'I want to speak to a human',
        prospectRef.current,
      );
      if (followUp?.prospectPatch) {
        const next = applyIntelligence({ ...prospectRef.current, ...followUp.prospectPatch });
        prospectRef.current = next;
        setProspect(next);
      }
      if (followUp?.instruction) sendInstruction(followUp.instruction);
      addEntry(
        'system',
        type === 'demo'
          ? 'Demo follow-up requested. Waiting for preferred date and time.'
          : 'Human follow-up requested. Waiting for preferred date and time.',
      );
      setAgentState('speaking');
    },
    [addEntry, sendInstruction],
  );

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      activeRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (endingTimerRef.current) clearTimeout(endingTimerRef.current);
      rtcRef.current?.off();
      rtcRef.current?.destroy();
      agentRef.current?.off();
      toolkitRef.current?.destroy();
      void rtmRef.current?.logout();
    };
  }, []);

  return {
    status,
    agentState,
    transcript,
    prospect,
    isMuted,
    error,
    summary,
    start,
    end,
    toggleMute,
    escalate,
  };
}
