import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AgentState,
  ConversationStatus,
  ConversationSummary,
  ProspectInfo,
  TranscriptEntry,
} from '@/types/conversation';

import { emptyProspect } from '@/types/conversation';

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

  const objectType =
    typeof object.object === 'string'
      ? object.object
      : '';

  const typeText = `${objectType} ${
    typeof object.type === 'string'
      ? object.type
      : ''
  }`;

  const roleText = [
    object.role,
    object.speaker,
    object.sender,
    object.participant_type,
    object.source,
  ].find(
    (entry): entry is string =>
      typeof entry === 'string',
  );

  const text = [
    object.text,
    object.message,
    object.transcript,
    object.content,
    object.text_content,
  ]
    .find(
      (entry): entry is string =>
        typeof entry === 'string' &&
        entry.trim().length > 0,
    )
    ?.trim();

  if (
    text &&
    (
      /transcription|transcript/i.test(typeText) ||
      Boolean(roleText) ||
      object.is_customer === true ||
      object.is_user === true
    )
  ) {
    const isCustomer =
      object.is_customer === true ||
      object.is_user === true ||
      /user|customer|human|remote|caller|input/i.test(
        roleText ?? '',
      ) ||
      /user\./i.test(typeText);

    const turnId =
      object.turn_id ??
      object.turn_seq_id;

    const key =
      typeof turnId === 'string' ||
      typeof turnId === 'number'
        ? `${typeText}:${turnId}`
        : `${typeText}:${text.toLowerCase()}`;

    return {
      text,
      role: isCustomer
        ? 'customer'
        : 'agent',
      key,
    };
  }

  for (const child of Object.values(object)) {
    const nested = findTranscriptEvent(child);

    if (nested) {
      return nested;
    }
  }

  return null;
}

/**
 * Detect an explicit request for a human sales representative.
 */
function isHumanEscalationRequest(
  text: string,
): boolean {
  return /\b(?:speak\s+(?:to|with)\s+(?:a\s+)?human|talk\s+(?:to|with)\s+(?:a\s+)?human|connect\s+(?:me\s+)?(?:to|with)\s+(?:a\s+)?human|contact\s+(?:me\s+)?(?:with|by)\s+(?:a\s+)?human|human\s+(?:sales\s+)?(?:representative|rep|agent|specialist)|real\s+person|real\s+human|human\s+agent|human\s+representative|sales\s+representative|sales\s+rep|speak\s+to\s+(?:someone|a\s+person)|talk\s+to\s+(?:someone|a\s+person))\b/i.test(
    text,
  );
}

/**
 * Detect whether the customer has supplied enough
 * scheduling information for a useful human follow-up reminder.
 *
 * Examples:
 * "tomorrow at 3 PM"
 * "Monday at 11 AM"
 * "September 10 at 4 PM"
 * "next week at 2:30"
 */
function extractHumanFollowUpRequest(
  text: string,
): string | null {
  const normalized = text.trim();

  const hasTime =
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(
      normalized,
    ) ||
    /\b(?:at\s+)?\d{1,2}:\d{2}\b/.test(
      normalized,
    );

  const hasDate =
    /\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?)\b/i.test(
      normalized,
    );

  if (hasDate && hasTime) {
    return normalized;
  }

  return null;
}

async function persistConversation(
  channelName: string | null,
  summary: ConversationSummary,
): Promise<void> {
  const {
    data: conversation,
    error: conversationError,
  } = await supabase
    .from('conversations')
    .insert({
      channel_name: channelName,
      started_at: new Date(
        summary.startedAt,
      ).toISOString(),
      ended_at: new Date(
        summary.endedAt,
      ).toISOString(),
      duration_seconds:
        summary.durationSeconds,
      transcript: summary.transcript,
      prospect: summary.prospect,
      summary_text: summary.summaryText,
      customer_requirements:
        summary.customerRequirements,
      recommended_plan:
        summary.recommendedPlan,
      lead_status: summary.leadStatus,
      interest_level:
        summary.interestLevel,
      estimated_deal_value:
        summary.estimatedDealValue,
      next_action: summary.nextAction,
      escalation_status:
        summary.escalationStatus,
    })
    .select('id')
    .single();

  if (conversationError) {
    throw conversationError;
  }

  const { error: leadError } =
    await supabase
      .from('leads')
      .insert({
        conversation_id: conversation.id,
        contact_name:
          summary.prospect.contactName,
        company:
          summary.prospect.company,
        contact_email:
          summary.prospect.contactEmail,
        team_size:
          summary.prospect.teamSize,
        use_case:
          summary.prospect.useCase,
        requirements:
          summary.customerRequirements,
        lead_status:
          summary.leadStatus,
        interest_level:
          summary.interestLevel,
        recommended_plan:
          summary.recommendedPlan,
        estimated_deal_value:
          summary.estimatedDealValue,
        escalation_status:
          summary.escalationStatus,
      });

  if (leadError) {
    throw leadError;
  }
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
  injectCustomerMessage: (
    text: string,
  ) => void;
}

export function useVoiceConversation(): UseVoiceConversationReturn {
  const [status, setStatus] =
    useState<ConversationStatus>('idle');

  const [agentState, setAgentState] =
    useState<AgentState>('idle');

  const [transcript, setTranscript] =
    useState<TranscriptEntry[]>([]);

  const [prospect, setProspect] =
    useState<ProspectInfo>(
      emptyProspect(),
    );

  const [isMuted, setIsMuted] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [summary, setSummary] =
    useState<ConversationSummary | null>(
      null,
    );

  const [isSimMode, setIsSimMode] =
    useState(false);

  const transcriptRef =
    useRef<TranscriptEntry[]>([]);

  const transcriptKeysRef =
    useRef<Map<string, string>>(
      new Map(),
    );

  const processedCustomerEventsRef =
    useRef<Map<string, string>>(
      new Map(),
    );

  const rtcRef =
    useRef<IAgoraRtcClient | null>(null);

  const agentRef =
    useRef<IAgoraAgentClient | null>(
      null,
    );

  const simTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const simIndexRef =
    useRef(0);

  const startedAtRef =
    useRef<number>(0);

  const simModeRef =
    useRef(false);

  const activeRef =
    useRef(false);

  const channelRef =
    useRef<string | null>(null);

  const endingPromptCountRef =
    useRef(0);

  const silencePromptCountRef =
    useRef(0);

  const silenceTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const endingTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  /**
   * Stores the customer's requested
   * human follow-up scheduling text.
   */
  const humanFollowUpRequestRef =
    useRef<string | null>(null);

  /**
   * Prevents repeatedly sending the same
   * human-escalation instruction.
   */
  const humanEscalationInstructionSentRef =
    useRef(false);

  const addEntry = useCallback(
    (
      role: TranscriptEntry['role'],
      text: string,
      key?: string,
    ) => {
      const entry: TranscriptEntry = {
        id: genId(),
        role,
        text,
        timestamp: Date.now(),
      };

      setTranscript((prev) => {
        if (key) {
          const existingId =
            transcriptKeysRef.current.get(
              key,
            );

          if (existingId) {
            const next = prev.map(
              (item) =>
                item.id === existingId
                  ? {
                      ...item,
                      text,
                    }
                  : item,
            );

            transcriptRef.current =
              next;

            return next;
          }

          transcriptKeysRef.current.set(
            key,
            entry.id,
          );
        }

        const next = [
          ...prev,
          entry,
        ];

        transcriptRef.current =
          next;

        return next;
      });

      return entry;
    },
    [],
  );

  const updateProspect = useCallback(
    (customerText: string) => {
      setProspect((prev) => {
        const {
          prospectPatch,
          detectedPlanInterest,
        } = parseCustomerMessage(
          customerText,
          prev,
        );

        const next = {
          ...prev,
          ...prospectPatch,
        };

        const plan =
          recommendPlan(next);

        if (plan) {
          next.recommendedPlan =
            plan.id;

          next.estimatedDealValue =
            plan.priceMonthly;
        }

        next.leadStatus =
          qualifyLead(next);

        if (
          detectedPlanInterest &&
          !next.recommendedPlan
        ) {
          next.recommendedPlan =
            detectedPlanInterest;

          const detectedPlan =
            recommendPlan(next);

          if (detectedPlan) {
            next.estimatedDealValue =
              detectedPlan.priceMonthly;
          }
        }

        return next;
      });
    },
    [],
  );

  /**
   * Handle human escalation and scheduling.
   */
  const handleHumanEscalation =
    useCallback(
      (customerText: string) => {
        const humanRequested =
          isHumanEscalationRequest(
            customerText,
          );

        const followUpRequest =
          extractHumanFollowUpRequest(
            customerText,
          );

        /**
         * Customer supplied a date/time.
         */
        if (followUpRequest) {
          humanFollowUpRequestRef.current =
            followUpRequest;

          setProspect((prev) => ({
            ...prev,
            escalationStatus:
              'requested',
            leadStatus:
              'escalated',
          }));

          agentRef.current?.sendControl({
            type: 'update_instructions',
            payload: {
              instruction:
                `The customer has provided a preferred time for a human sales follow-up: "${followUpRequest}".

Acknowledge the requested time and say that the preferred follow-up time will be recorded for the sales team.

Do NOT claim that the meeting is booked.
Do NOT claim that a human has already been notified.
Do NOT claim that a human has already been connected.
Do NOT invent a representative or contact.

Keep the response brief and professional.`,
            },
          });

          return;
        }

        /**
         * Customer explicitly asks for a human.
         */
        if (
          humanRequested &&
          !humanEscalationInstructionSentRef.current
        ) {
          humanEscalationInstructionSentRef.current =
            true;

          setProspect((prev) => ({
            ...prev,
            escalationStatus:
              'requested',
            leadStatus:
              'escalated',
          }));

          if (silenceTimerRef.current) {
            clearTimeout(
              silenceTimerRef.current,
            );

            silenceTimerRef.current =
              null;
          }

          if (endingTimerRef.current) {
            clearTimeout(
              endingTimerRef.current,
            );

            endingTimerRef.current =
              null;
          }

          agentRef.current?.sendControl({
            type: 'update_instructions',
            payload: {
              instruction:
                `The customer has requested to speak with a human sales specialist.

Do NOT say that you are connecting them immediately.
Do NOT claim that a human has been notified.
Do NOT claim that a meeting is booked.
Do NOT claim that a representative has been assigned.

Instead, acknowledge the request and ask:

"Absolutely. I can request a human sales specialist to follow up with you. What date and time would work best for you?"

Ask only for the preferred date and time.

Keep the response brief and professional.`,
            },
          });
        }
      },
      [],
    );

  const processCustomerMessage =
    useCallback(
      (text: string) => {
        addEntry(
          'customer',
          text,
        );

        updateProspect(text);

        handleHumanEscalation(
          text,
        );

        setAgentState(
          'thinking',
        );

        setTimeout(() => {
          setProspect(
            (currentProspect) => {
              const phase =
                detectPhase(
                  text,
                  currentProspect,
                );

              const response =
                generateAgentResponse(
                  text,
                  currentProspect,
                  phase,
                );

              setAgentState(
                'speaking',
              );

              addEntry(
                'agent',
                response,
              );

              setTimeout(() => {
                setAgentState(
                  (s) =>
                    s === 'speaking'
                      ? 'listening'
                      : s,
                );
              }, 2000);

              return currentProspect;
            },
          );
        }, 800);
      },
      [
        addEntry,
        updateProspect,
        handleHumanEscalation,
      ],
    );

  const handleLiveMessage =
    useCallback(
      (data: string) => {
        try {
          const raw =
            JSON.parse(data) as Record<
              string,
              unknown
            >;

          const event =
            findTranscriptEvent(raw);

          if (!event) {
            return;
          }

          const {
            text,
            role,
            key,
          } = event;

          if (role === 'customer') {
            addEntry(
              'customer',
              text,
              key,
            );

            if (
              processedCustomerEventsRef.current.get(
                key,
              ) === text
            ) {
              return;
            }

            processedCustomerEventsRef.current.set(
              key,
              text,
            );

            updateProspect(text);

            handleHumanEscalation(
              text,
            );

            silencePromptCountRef.current =
              0;

            if (
              /\b(?:bye|goodbye|thank\s+you|thanks|that's\s+all|that\s+is\s+all|no\s+further\s+questions)\b/i.test(
                text,
              )
            ) {
              endingPromptCountRef.current +=
                1;

              if (
                endingPromptCountRef.current <=
                3
              ) {
                agentRef.current?.sendControl({
                  type: 'update_instructions',
                  payload: {
                    instruction:
                      'Ask the customer once whether they would like to end the call.',
                  },
                });

                addEntry(
                  'agent',
                  'Would you like to end the call?',
                );
              }

              if (
                endingPromptCountRef.current >=
                3
              ) {
                rtcRef.current?.muteLocalAudio();

                setIsMuted(true);
              } else if (
                !endingTimerRef.current
              ) {
                endingTimerRef.current =
                  setTimeout(() => {
                    endingTimerRef.current =
                      null;

                    endingPromptCountRef.current +=
                      1;

                    if (
                      endingPromptCountRef.current <=
                      3
                    ) {
                      agentRef.current?.sendControl({
                        type: 'update_instructions',
                        payload: {
                          instruction:
                            'Ask the customer once whether they would like to end the call.',
                        },
                      });

                      addEntry(
                        'agent',
                        'Would you like to end the call?',
                      );
                    }

                    if (
                      endingPromptCountRef.current >=
                      3
                    ) {
                      rtcRef.current?.muteLocalAudio();

                      setIsMuted(true);
                    } else {
                      endingTimerRef.current =
                        setTimeout(
                          () => {
                            endingTimerRef.current =
                              null;

                            endingPromptCountRef.current +=
                              1;

                            agentRef.current?.sendControl({
                              type: 'update_instructions',
                              payload: {
                                instruction:
                                  'Ask the customer once whether they would like to end the call.',
                              },
                            });

                            addEntry(
                              'agent',
                              'Would you like to end the call?',
                            );

                            rtcRef.current?.muteLocalAudio();

                            setIsMuted(true);
                          },
                          10000,
                        );
                    }
                  }, 10000);
              }
            }
          } else {
            addEntry(
              'agent',
              text,
              key,
            );
          }
        } catch {
          return;
        }
      },
      [
        addEntry,
        updateProspect,
        handleHumanEscalation,
      ],
    );

  const runSimulation =
    useCallback(() => {
      if (!activeRef.current) {
        return;
      }

      const idx =
        simIndexRef.current;

      if (
        idx >=
        SIMULATION_SCRIPT.length
      ) {
        simTimerRef.current =
          setTimeout(() => {
            if (activeRef.current) {
              void endInternal();
            }
          }, 4000);

        return;
      }

      const turn =
        SIMULATION_SCRIPT[idx];

      simIndexRef.current +=
        1;

      simTimerRef.current =
        setTimeout(() => {
          if (!activeRef.current) {
            return;
          }

          processCustomerMessage(
            turn.customerText,
          );

          runSimulation();
        }, turn.delayMs);
    }, [processCustomerMessage]);

  const start = useCallback(
    async () => {
      if (
        status === 'connecting' ||
        status === 'connected'
      ) {
        return;
      }

      setError(null);
      setSummary(null);
      setStatus('connecting');
      setAgentState('idle');
      setTranscript([]);

      transcriptRef.current =
        [];

      transcriptKeysRef.current.clear();

      processedCustomerEventsRef.current.clear();

      setProspect(
        emptyProspect(),
      );

      endingPromptCountRef.current =
        0;

      silencePromptCountRef.current =
        0;

      humanFollowUpRequestRef.current =
        null;

      humanEscalationInstructionSentRef.current =
        false;

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current,
        );

        silenceTimerRef.current =
          null;
      }

      if (endingTimerRef.current) {
        clearTimeout(
          endingTimerRef.current,
        );

        endingTimerRef.current =
          null;
      }

      resetSimCounter();

      entryId = 0;

      activeRef.current =
        true;

      startedAtRef.current =
        Date.now();

      const configured =
        isAgoraConfigured();

      setIsSimMode(
        !configured,
      );

      simModeRef.current =
        !configured;

      try {
        const rtc =
          await createRtcClient();

        rtcRef.current =
          rtc;

        const channelName =
          `nexavoice-${Date.now()}`;

        channelRef.current =
          channelName;

        const browserUid =
          generateBrowserRtcUid();

        const agent =
          await createAgentClient(
            channelName,
            browserUid,
            (data) => {
              rtcRef.current?.sendStreamMessage(
                data,
              );
            },
          );

        agentRef.current =
          agent;

        agent.on({
          onAgentStateChange:
            (state) => {
              setAgentState(
                state,
              );
            },

          onAgentMessage:
            (entry) => {
              addEntry(
                'agent',
                entry.text,
              );
            },

          onCustomerMessage:
            (entry) => {
              addEntry(
                'customer',
                entry.text,
              );

              updateProspect(
                entry.text,
              );

              handleHumanEscalation(
                entry.text,
              );
            },

          onError:
            (message) => {
              setError(message);
            },
        });

        rtc.on({
          onStreamMessage:
            (_uid, data) => {
              handleLiveMessage(
                data,
              );
            },
        });

        const token =
          await fetchAgoraToken(
            channelName,
            browserUid,
          );

        if (!token) {
          throw new Error(
            'Agora is not configured',
          );
        }

        await rtc.join(token);

        await agent.start();

        setStatus(
          'connected',
        );

        setAgentState(
          'listening',
        );

        setTimeout(() => {
          if (
            simModeRef.current
          ) {
            addEntry(
              'agent',
              greetingMessage(),
            );

            setAgentState(
              'listening',
            );

            simIndexRef.current =
              0;

            simTimerRef.current =
              setTimeout(() => {
                runSimulation();
              }, 3000);
          }
        }, 1000);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to start conversation';

        setError(msg);
        setStatus('error');

        activeRef.current =
          false;
      }
    },
    [
      status,
      addEntry,
      updateProspect,
      handleHumanEscalation,
      handleLiveMessage,
      runSimulation,
    ],
  );

  const endInternal =
    useCallback(async () => {
      activeRef.current =
        false;

      if (simTimerRef.current) {
        clearTimeout(
          simTimerRef.current,
        );

        simTimerRef.current =
          null;
      }

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current,
        );

        silenceTimerRef.current =
          null;
      }

      if (endingTimerRef.current) {
        clearTimeout(
          endingTimerRef.current,
        );

        endingTimerRef.current =
          null;
      }

      setAgentState('idle');

      try {
        await agentRef.current?.stop();

        await rtcRef.current?.leave();
      } catch {
        // Best-effort cleanup.
      }

      rtcRef.current?.off();
      rtcRef.current?.destroy();

      rtcRef.current =
        null;

      agentRef.current?.off();

      agentRef.current =
        null;

      setProspect(
        (finalProspect) => {
          const leadStatus =
            qualifyLead(
              finalProspect,
            );

          const plan =
            recommendPlan(
              finalProspect,
            );

          const dealValue =
            estimateDealValue(
              finalProspect,
            );

          const endedAt =
            Date.now();

          /**
           * Generate the final next action.
           *
           * If the customer requested a human
           * and supplied a date/time, this becomes
           * the generated reminder shown in the
           * conversation summary.
           */
          let generatedNextAction =
            nextAction(
              finalProspect,
              leadStatus,
            );

          if (
            finalProspect.escalationStatus ===
              'requested' &&
            humanFollowUpRequestRef.current
          ) {
            generatedNextAction =
              `Human sales follow-up requested for ${humanFollowUpRequestRef.current}. Contact the prospect at the requested time.`;
          } else if (
            finalProspect.escalationStatus ===
            'requested'
          ) {
            generatedNextAction =
              'Human sales follow-up requested. Obtain and confirm the prospect’s preferred date and time.';
          }

          const conversationSummary:
            ConversationSummary = {
              startedAt:
                startedAtRef.current,

              endedAt,

              durationSeconds:
                Math.round(
                  (endedAt -
                    startedAtRef.current) /
                    1000,
                ),

              transcript:
                transcriptRef.current,

              prospect:
                finalProspect,

              summaryText:
                buildSummary(
                  finalProspect,
                ),

              customerRequirements:
                finalProspect.requirements,

              recommendedPlan:
                plan?.id ?? null,

              leadStatus,

              interestLevel:
                finalProspect.interestLevel,

              estimatedDealValue:
                dealValue,

              nextAction:
                generatedNextAction,

              escalationStatus:
                finalProspect.escalationStatus,
            };

          setSummary(
            conversationSummary,
          );

          void persistConversation(
            channelRef.current,
            conversationSummary,
          ).catch(
            (
              persistError: unknown,
            ) => {
              setError(
                persistError instanceof
                  Error
                  ? persistError.message
                  : 'Unable to save conversation lead',
              );
            },
          );

          return finalProspect;
        },
      );

      setStatus('ended');
    }, []);

  const end =
    useCallback(async () => {
      await endInternal();
    }, [endInternal]);

  const toggleMute =
    useCallback(() => {
      setIsMuted((prev) => {
        const next = !prev;

        if (next) {
          rtcRef.current?.muteLocalAudio();
        } else {
          rtcRef.current?.unmuteLocalAudio();
        }

        if (silenceTimerRef.current) {
          clearTimeout(
            silenceTimerRef.current,
          );

          silenceTimerRef.current =
            null;
        }

        if (next) {
          silencePromptCountRef.current =
            0;

          const prompt = () => {
            if (
              !activeRef.current ||
              !rtcRef.current?.isLocalAudioMuted()
            ) {
              return;
            }

            silencePromptCountRef.current +=
              1;

            agentRef.current?.sendControl({
              type: 'update_instructions',
              payload: {
                instruction:
                  'Ask the customer if they are still present.',
              },
            });

            addEntry(
              'agent',
              'Are you still there?',
            );

            if (
              silencePromptCountRef.current <
              2
            ) {
              silenceTimerRef.current =
                setTimeout(
                  prompt,
                  10000,
                );
            }
          };

          silenceTimerRef.current =
            setTimeout(
              prompt,
              10000,
            );
        }

        return next;
      });
    }, [addEntry]);

  /**
   * Manual human escalation button.
   *
   * The application does not claim that a human
   * has already been connected or notified.
   */
  const escalate =
    useCallback(() => {
      humanEscalationInstructionSentRef.current =
        true;

      setProspect((prev) => ({
        ...prev,
        escalationStatus:
          'requested',
        leadStatus:
          'escalated',
      }));

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current,
        );

        silenceTimerRef.current =
          null;
      }

      if (endingTimerRef.current) {
        clearTimeout(
          endingTimerRef.current,
        );

        endingTimerRef.current =
          null;
      }

      agentRef.current?.sendControl({
        type: 'update_instructions',
        payload: {
          instruction:
            `The customer has requested a human sales specialist.

Do NOT claim that you are connecting them immediately.
Do NOT claim that a human has been notified.
Do NOT claim that a meeting is booked.
Do NOT claim that a representative has been assigned.

Ask the customer for their preferred date and time for a human sales specialist to follow up.

Say:

"Absolutely. I can request a human sales specialist to follow up with you. What date and time would work best for you?"

Keep the response brief and professional.`,
        },
      });

      addEntry(
        'system',
        'Human sales follow-up requested. Waiting for preferred date and time.',
      );

      setAgentState(
        'speaking',
      );
    }, [addEntry]);

  const injectCustomerMessage =
    useCallback(
      (text: string) => {
        if (
          status !== 'connected'
        ) {
          return;
        }

        processCustomerMessage(
          text,
        );
      },
      [
        status,
        processCustomerMessage,
      ],
    );

  useEffect(() => {
    return () => {
      activeRef.current =
        false;

      if (simTimerRef.current) {
        clearTimeout(
          simTimerRef.current,
        );
      }

      if (silenceTimerRef.current) {
        clearTimeout(
          silenceTimerRef.current,
        );
      }

      if (endingTimerRef.current) {
        clearTimeout(
          endingTimerRef.current,
        );
      }

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