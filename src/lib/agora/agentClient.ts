import type { AgentEventHandlers, AgentControlMessage } from '@/lib/agora/types';

export interface IAgoraAgentClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  on(handlers: AgentEventHandlers): void;
  off(): void;
  sendControl(message: AgentControlMessage): void;
}

/**
 * Factory returning a real Conversational AI agent client when credentials are
 * present, or a stub only when Agora is not configured. The UI only depends on
 * this interface.
 */
export async function createAgentClient(
  channelName: string,
  browserUid: number,
  sendStreamMessage?: (data: string) => void,
): Promise<IAgoraAgentClient> {
  const { isAgoraConfigured } = await import('@/lib/agora/config');
  if (isAgoraConfigured()) return createRealAgentClient(channelName, browserUid, sendStreamMessage);
  return createStubAgentClient(channelName);
}

async function createRealAgentClient(
  channelName: string,
  browserUid: number,
  sendStreamMessage?: (data: string) => void,
): Promise<IAgoraAgentClient> {
  const { getAgoraRuntimeConfig, getSupabaseFunctionHeaders } = await import('@/lib/agora/config');
  const cfg = getAgoraRuntimeConfig();
  let handlers: AgentEventHandlers = {};
  let started = false;
  let agentId: string | undefined;

  async function provisionAgent() {
    const response = await fetch(`${cfg.apiBase}/agora-token`, {
        method: 'POST',
        headers: getSupabaseFunctionHeaders(),
        body: JSON.stringify({ action: 'start', channelName, browserUid }),
      });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? 'Unable to start Agora Conversational AI agent');
    }
    agentId = (await response.clone().json().catch(() => ({})))?.agentId;
  }

  return {
    async start() {
      if (started) return;
      await provisionAgent();
      started = true;
      handlers.onAgentStateChange?.('listening');
    },
    async stop() {
      if (!started) return;
      started = false;
      try {
        const response = await fetch(`${cfg.apiBase}/agora-token`, {
           method: 'POST',
           headers: getSupabaseFunctionHeaders(),
           body: JSON.stringify({ action: 'stop', channelName, agentId }),
         });
         if (!response.ok) throw new Error('Unable to stop Agora Conversational AI agent');
      } catch {
        // best-effort
      }
      handlers.onAgentStateChange?.('idle');
    },
    on(h: AgentEventHandlers) {
      handlers = h;
    },
    off() {
      handlers = {};
    },
    sendControl(message: AgentControlMessage) {
      sendStreamMessage?.(JSON.stringify(message));
    },
  };
}

function createStubAgentClient(channelName: string): IAgoraAgentClient {
  void channelName;
  let handlers: AgentEventHandlers = {};
  let started = false;

  return {
    async start() {
      if (started) return;
      started = true;
      handlers.onAgentStateChange?.('listening');
    },
    async stop() {
      started = false;
      handlers.onAgentStateChange?.('idle');
    },
    on(h: AgentEventHandlers) {
      handlers = h;
    },
    off() {
      handlers = {};
    },
    sendControl() {},
  };
}

export { fetchAgoraToken } from '@/lib/agora/config';
