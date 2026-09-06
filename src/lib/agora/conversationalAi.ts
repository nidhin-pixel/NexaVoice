import type { AgentState, TranscriptEntry } from '@/types/conversation';
import type { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import type { RTMEngine } from 'agora-agent-client-toolkit';

interface TranscriptItem {
  uid?: string | number;
  turn_id?: string | number;
  text?: string;
  status?: string | number;
  metadata?: {
    object?: string;
    type?: string;
    role?: string;
    words?: unknown;
  } | null;
}

interface ConversationalSession {
  unsubscribe(): void;
  destroy(): void;
}

function roleFromItem(item: TranscriptItem): 'customer' | 'agent' {
  const blob = `${item.metadata?.object ?? ''} ${item.metadata?.type ?? ''} ${item.metadata?.role ?? ''} ${item.uid ?? ''}`;
  if (/user|customer|human|remote/i.test(blob)) return 'customer';
  return 'agent';
}

/**
 * Attach Agora Agent Client Toolkit + RTM to the existing RTC client.
 * Does not replace join/publish or the Conversational AI pipeline ID.
 */
export async function attachConversationalToolkit(options: {
  rtcEngine: IAgoraRTCClient | null | undefined;
  rtmEngine: RTMEngine | null | undefined;
  channelName: string;
  onTranscript: (entry: { role: TranscriptEntry['role']; text: string; key: string }) => void;
  onAgentState?: (state: AgentState) => void;
  onError?: (message: string) => void;
}): Promise<ConversationalSession | null> {
  if (!options.rtcEngine) return null;

  try {
    const toolkit = await import('agora-agent-client-toolkit');
    const AgoraVoiceAI = toolkit.AgoraVoiceAI;
    const events = toolkit.AgoraVoiceAIEvents;

    try {
      AgoraVoiceAI.getInstance()?.destroy?.();
    } catch {
      // No previous instance.
    }

    const ai = await AgoraVoiceAI.init({
      rtcEngine: options.rtcEngine,
      rtmEngine: options.rtmEngine ?? undefined,
      enableLog: false,
    });
    console.log('[Toolkit] init ok', { rtc: Boolean(options.rtcEngine), rtm: Boolean(options.rtmEngine) });

    // The composite AGENT_STATE_CHANGED event (state: idle | listening |
    // thinking | speaking | silent) is the authoritative agent state — it is
    // derived from the agent's RTM presence `stateChanged.state`. Map it
    // directly to the UI state. The discrete listening/thinking/speaking
    // events are only a fallback until the first composite event arrives,
    // with correct handling of the `active=false` transitions.
    let compositeStateSeen = false;
    const mapAgentState = (raw: string | undefined): AgentState | undefined => {
      switch (raw) {
        case 'listening':
        case 'silent': // UI has no 'silent' state; silent ≈ listening/ready
          return 'listening';
        case 'thinking':
          return 'thinking';
        case 'speaking':
          return 'speaking';
        case 'idle':
          return 'idle';
        default:
          return undefined;
      }
    };

    ai.on(events.AGENT_STATE_CHANGED, (_id: string, event: { state?: string }) => {
      const state = mapAgentState(event?.state);
      if (!state) return;
      compositeStateSeen = true;
      console.log('[Toolkit] AGENT_STATE_CHANGED', event?.state, event);
      options.onAgentState?.(state);
    });
    ai.on(events.AGENT_LISTENING_CHANGED, (_id: string, active: boolean) => {
      if (!compositeStateSeen && active) options.onAgentState?.('listening');
    });
    ai.on(events.AGENT_THINKING_CHANGED, (_id: string, active: boolean) => {
      if (!compositeStateSeen && active) options.onAgentState?.('thinking');
    });
    ai.on(events.AGENT_SPEAKING_CHANGED, (_id: string, active: boolean) => {
      // active=false means the agent finished speaking → back to listening.
      if (!compositeStateSeen) options.onAgentState?.(active ? 'speaking' : 'listening');
    });
    ai.on(events.AGENT_ERROR, (_id: string, error: { message?: string }) => {
      options.onError?.(error?.message || 'Emily reported a voice-agent error.');
    });

    ai.on(events.TRANSCRIPT_UPDATED, (transcript) => {
      if (!Array.isArray(transcript)) return;
      console.log('[Toolkit] TRANSCRIPT_UPDATED', transcript.length, 'items — raw sample:', transcript.slice(0, 2));
      // TRANSCRIPT_UPDATED delivers the complete conversation history. Reconcile
      // every item so interim updates and interleaved turns are reflected in the
      // live transcript; the consumer deduplicates by key (no blind appends).
      for (const item of transcript) {
        const text = item?.text?.trim();
        if (!item || !text) continue;
        const role = roleFromItem(item);
        const key = `toolkit:${item.uid ?? role}:${item.turn_id ?? text.toLowerCase()}`;
        options.onTranscript({ role, text, key });
      }
    });

    ai.subscribeMessage(options.channelName);
    console.log('[Toolkit] subscribeMessage', options.channelName);

    return {
      unsubscribe() {
        try {
          ai.unsubscribe();
        } catch {
          // ignore
        }
      },
      destroy() {
        try {
          ai.unsubscribe();
          ai.destroy();
        } catch {
          // ignore
        }
      },
    };
  } catch (err) {
    console.warn('[Toolkit] attach failed', err);
    return null;
  }
}
