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

    ai.on(events.TRANSCRIPT_UPDATED, (transcript) => {
      if (!Array.isArray(transcript)) return;
      const latest = transcript[transcript.length - 1];
      const text = latest?.text?.trim();
      if (!latest || !text) return;
      const role = roleFromItem(latest);
      const key = `toolkit:${latest.uid ?? role}:${latest.turn_id ?? text.toLowerCase()}`;
      options.onTranscript({ role, text, key });
    });

    ai.on(events.AGENT_LISTENING_CHANGED, (_id: string, active: boolean) => {
      if (active) options.onAgentState?.('listening');
    });
    ai.on(events.AGENT_THINKING_CHANGED, (_id: string, active: boolean) => {
      if (active) options.onAgentState?.('thinking');
    });
    ai.on(events.AGENT_SPEAKING_CHANGED, (_id: string, active: boolean) => {
      if (active) options.onAgentState?.('speaking');
    });
    ai.on(events.AGENT_ERROR, (_id: string, error: { message?: string }) => {
      options.onError?.(error?.message || 'Emily reported a voice-agent error.');
    });

    ai.subscribeMessage(options.channelName);

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
  } catch {
    return null;
  }
}
