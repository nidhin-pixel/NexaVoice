import type { AgoraConfig } from '@/types/conversation';
import type { IAgoraRTCRemoteUser, IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export type RtcEventName =
  | 'user-published'
  | 'user-unpublished'
  | 'user-left'
  | 'volume-indicator'
  | 'network-quality'
  | 'connection-state'
  | 'stream-message';

export interface RtcEventHandlers {
  onUserPublished?: (uid: number, mediaType: 'audio' | 'video') => void;
  onUserUnpublished?: (uid: number, mediaType: 'audio' | 'video') => void;
  onVolumeIndicator?: (volumes: { uid: number; level: number }[]) => void;
  onConnectionStateChanged?: (state: string, reason: string) => void;
  onStreamMessage?: (uid: number, data: string) => void;
}

export interface IAgoraRtcClient {
  join(config: AgoraConfig): Promise<void>;
  leave(): Promise<void>;
  muteLocalAudio(): void;
  unmuteLocalAudio(): void;
  isLocalAudioMuted(): boolean;
  on(handlers: RtcEventHandlers): void;
  off(): void;
  sendStreamMessage(data: string): void;
  getRemoteAudioLevel(): number;
  destroy(): void;
  /** Exposes the underlying Agora RTC client for the Conversational AI toolkit. */
  getRawClient?: () => IAgoraRTCClient | null;
}

/**
 * Factory that returns a real Agora RTC client when the SDK + credentials are
 * available, or a no-op stub only when Agora is not configured. The UI never imports the Agora SDK
 * directly — it only talks to this interface.
 */
export async function createRtcClient(): Promise<IAgoraRtcClient> {
  const { isAgoraConfigured } = await import('@/lib/agora/config');
  if (isAgoraConfigured()) return createRealRtcClient();
  return createStubRtcClient();
}

async function createRealRtcClient(): Promise<IAgoraRtcClient> {
  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  const { getAgoraRuntimeConfig } = await import('@/lib/agora/config');

  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  const config = getAgoraRuntimeConfig();
  let localAudioTrack: { setMuted: (m: boolean) => void; close: () => void } | null = null;
  let muted = false;
  let handlers: RtcEventHandlers = {};
  let streamChannel: { sendMessage: (data: string) => void } | null = null;
  const streamChunks = new Map<string, { total: number; parts: Map<number, string> }>();

  client.on('user-published', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    handlers.onUserPublished?.(Number(user.uid), mediaType);
    client
      .subscribe(user, mediaType)
      .then(() => {
        if (mediaType === 'audio' && user.audioTrack) user.audioTrack.play();
      })
      .catch(() => {});
  });

  client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    handlers.onUserUnpublished?.(Number(user.uid), mediaType);
  });

  client.on('volume-indicator', (result: { result: { uid: number; level: number }[] }) => {
    const vols = (result?.result ?? []).map((r) => ({ uid: r.uid, level: r.level }));
    handlers.onVolumeIndicator?.(vols);
  });

  client.on('connection-state-change', (state: string, reason: string) => {
    handlers.onConnectionStateChanged?.(state, reason);
  });

  return {
    async join(cfg: AgoraConfig) {
      const appId = cfg.appId || config.appId;
      await client.join(appId, cfg.channelName, cfg.token, cfg.uid);
      const mic = await AgoraRTC.createMicrophoneAudioTrack();
      localAudioTrack = mic;
      muted = false;
      await client.publish([mic]);
      try {
        const sdk = client as unknown as {
          createDataStream?: (config: { reliable: boolean; ordered: boolean }) => number;
          sendStreamMessage?: (id: number, payload: Uint8Array) => Promise<void>;
          on: (event: string, handler: (uid: number, payload: Uint8Array) => void) => void;
        };
        const streamId = sdk.createDataStream?.({ reliable: true, ordered: true });
        sdk.on('stream-message', (uid: number, payload: Uint8Array) => {
          const decoded = decodeAgoraStreamPayload(new TextDecoder().decode(payload), streamChunks);
          if (decoded) handlers.onStreamMessage?.(uid, decoded);
        });
        if (typeof streamId === 'number') {
          streamChannel = {
            sendMessage: (data: string) => {
              void sdk.sendStreamMessage?.(streamId, new TextEncoder().encode(data));
            },
          };
        }

        function decodeAgoraStreamPayload(
          payload: string,
          chunks: Map<string, { total: number; parts: Map<number, string> }>,
        ): string | null {
          const match = payload.match(/^([^|]+)\|(\d+)\|(\d+)\|([\s\S]*)$/);
          if (!match) return payload;

          const [, messageId, indexText, totalText, encoded] = match;
          const index = Number(indexText);
          const total = Number(totalText);
          if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
            return null;
          }

          const current = chunks.get(messageId) ?? { total, parts: new Map<number, string>() };
          if (current.total !== total) {
            current.total = total;
            current.parts.clear();
          }
          current.parts.set(index, encoded);
          chunks.set(messageId, current);
          if (current.parts.size !== total) return null;

          const joined = Array.from({ length: total }, (_, partIndex) => current.parts.get(partIndex + 1) ?? '').join('');
          chunks.delete(messageId);

          try {
            const binary = atob(joined);
            const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
            return new TextDecoder().decode(bytes);
          } catch {
            return null;
          }
        }
      } catch {
        // streaming messages optional
      }
    },
    async leave() {
      if (localAudioTrack) localAudioTrack.close();
      localAudioTrack = null;
      await client.leave();
    },
    muteLocalAudio() {
      muted = true;
      localAudioTrack?.setMuted(true);
    },
    unmuteLocalAudio() {
      muted = false;
      localAudioTrack?.setMuted(false);
    },
    isLocalAudioMuted() {
      return muted;
    },
    on(h: RtcEventHandlers) {
      handlers = h;
    },
    off() {
      handlers = {};
    },
    sendStreamMessage(data: string) {
      try {
        streamChannel?.sendMessage(data);
      } catch {
        // no-op
      }
    },
    getRemoteAudioLevel() {
      return 0;
    },
    getRawClient() {
      return client;
    },
    destroy() {
      handlers = {};
    },
  };
}

function createStubRtcClient(): IAgoraRtcClient {
  let muted = false;
  let handlers: RtcEventHandlers = {};

  return {
    async join() {
      // simulate connection
      await new Promise((r) => setTimeout(r, 300));
      handlers.onConnectionStateChanged?.('CONNECTED', 'stub-join');
    },
    async leave() {
      handlers.onConnectionStateChanged?.('DISCONNECTED', 'stub-leave');
    },
    muteLocalAudio() {
      muted = true;
    },
    unmuteLocalAudio() {
      muted = false;
    },
    isLocalAudioMuted() {
      return muted;
    },
    on(h: RtcEventHandlers) {
      handlers = h;
    },
    off() {
      handlers = {};
    },
    sendStreamMessage() {},
    getRemoteAudioLevel() {
      return 0;
    },
    getRawClient() {
      return null;
    },
    destroy() {
      handlers = {};
    },
  };
}
