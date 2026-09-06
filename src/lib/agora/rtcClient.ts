import type { AgoraConfig } from '@/types/conversation';

import type { IAgoraRTCClient, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';

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
  onVolumeIndicator?: (
    volumes: { uid: number; level: number }[],
  ) => void;
  onConnectionStateChanged?: (state: string, reason: string) => void;
  onStreamMessage?: (uid: number, data: string) => void;
}

export interface IAgoraRtcClient {
  /**
   * Returns the underlying Agora RTC client.
   *
   * Used by AgoraVoiceAI / ConversationalAIAPI for the
   * RTC + RTM conversation integration.
   */
  getRawClient?: () => IAgoraRTCClient | null;

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
}

/**
 * Factory that returns a real Agora RTC client when the SDK + credentials are
 * available, or a no-op stub only when Agora is not configured.
 *
 * The UI never imports the Agora SDK directly — it only talks to this interface.
 */
export async function createRtcClient(): Promise<IAgoraRtcClient> {
  const { isAgoraConfigured } = await import('@/lib/agora/config');

  if (isAgoraConfigured()) {
    return createRealRtcClient();
  }

  return createStubRtcClient();
}

async function createRealRtcClient(): Promise<IAgoraRtcClient> {
  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;

  const { getAgoraRuntimeConfig } = await import('@/lib/agora/config');

  const client = AgoraRTC.createClient({
    mode: 'rtc',
    codec: 'vp8',
  });

  const config = getAgoraRuntimeConfig();

  let localAudioTrack: {
    setMuted: (muted: boolean) => void;
    close: () => void;
  } | null = null;

  let muted = false;

  let handlers: RtcEventHandlers = {};

  let streamChannel: {
    sendMessage: (data: string) => void;
  } | null = null;

  const streamChunks = new Map<
    string,
    {
      total: number;
      parts: Map<number, string>;
    }
  >();

  /**
   * Remote user published audio/video.
   */
  client.on(
    'user-published',
    (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      handlers.onUserPublished?.(Number(user.uid), mediaType);

      client
        .subscribe(user, mediaType)
        .then(() => {
          if (mediaType === 'audio' && user.audioTrack) {
            user.audioTrack.play();
          }
        })
        .catch(() => {
          // Best effort. The conversation can continue even if
          // remote audio playback fails.
        });
    },
  );

  /**
   * Remote user unpublished audio/video.
   */
  client.on(
    'user-unpublished',
    (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
      handlers.onUserUnpublished?.(Number(user.uid), mediaType);
    },
  );

  /**
   * Volume indicator.
   */
  client.on(
    'volume-indicator',
    (result: { result: { uid: number; level: number }[] }) => {
      const volumes = (result?.result ?? []).map((item) => ({
        uid: Number(item.uid),
        level: Number(item.level),
      }));

      handlers.onVolumeIndicator?.(volumes);
    },
  );

  /**
   * RTC connection state.
   */
  client.on(
    'connection-state-change',
    (state: string, reason: string) => {
      handlers.onConnectionStateChanged?.(state, reason);
    },
  );

  return {
    /**
     * Expose the underlying Agora RTC client.
     *
     * This does NOT change the existing RTC wrapper behaviour.
     * It allows useVoiceConversation.ts to initialize
     * AgoraVoiceAI / ConversationalAIAPI with the real RTC engine.
     */
    getRawClient() {
      return client;
    },

    /**
     * Join Agora RTC channel and publish microphone.
     */
    async join(cfg: AgoraConfig) {
      const appId = cfg.appId || config.appId;

      await client.join(
        appId,
        cfg.channelName,
        cfg.token,
        cfg.uid,
      );

      const mic = await AgoraRTC.createMicrophoneAudioTrack();

      localAudioTrack = mic;

      muted = false;

      await client.publish([mic]);

      /**
       * Existing RTC data-stream support.
       *
       * Keep this as a fallback/control channel.
       * Conversational transcript handling should use RTM,
       * not depend on this stream.
       */
      try {
        const sdk = client as unknown as {
          createDataStream?: (options: {
            reliable: boolean;
            ordered: boolean;
          }) => number;

          sendStreamMessage?: (
            id: number,
            payload: Uint8Array,
          ) => Promise<void>;

          on: (
            event: string,
            handler: (
              uid: number,
              payload: Uint8Array,
            ) => void,
          ) => void;
        };

        const streamId = sdk.createDataStream?.({
          reliable: true,
          ordered: true,
        });

        sdk.on(
          'stream-message',
          (uid: number, payload: Uint8Array) => {
            const decoded = decodeAgoraStreamPayload(
              new TextDecoder().decode(payload),
              streamChunks,
            );

            if (decoded) {
              handlers.onStreamMessage?.(uid, decoded);
            }
          },
        );

        if (typeof streamId === 'number') {
          streamChannel = {
            sendMessage: (data: string) => {
              void sdk.sendStreamMessage?.(
                streamId,
                new TextEncoder().encode(data),
              );
            },
          };
        }

      } catch {
        /**
         * RTC data streams are optional.
         *
         * The main voice path must continue working even if
         * data-stream initialization is unavailable.
         */
      }
    },

    /**
     * Leave RTC channel.
     */
    async leave() {
      if (localAudioTrack) {
        localAudioTrack.close();
      }

      localAudioTrack = null;

      streamChannel = null;

      streamChunks.clear();

      await client.leave();
    },

    /**
     * Mute microphone.
     */
    muteLocalAudio() {
      muted = true;

      localAudioTrack?.setMuted(true);
    },

    /**
     * Unmute microphone.
     */
    unmuteLocalAudio() {
      muted = false;

      localAudioTrack?.setMuted(false);
    },

    /**
     * Current microphone mute state.
     */
    isLocalAudioMuted() {
      return muted;
    },

    /**
     * Register event handlers.
     */
    on(newHandlers: RtcEventHandlers) {
      handlers = newHandlers;
    },

    /**
     * Remove event handlers.
     */
    off() {
      handlers = {};
    },

    /**
     * Existing RTC data-stream sender.
     */
    sendStreamMessage(data: string) {
      try {
        streamChannel?.sendMessage(data);
      } catch {
        // no-op
      }
    },

    /**
     * Remote audio level.
     *
     * Kept compatible with the existing interface.
     */
    getRemoteAudioLevel() {
      return 0;
    },

    /**
     * Destroy wrapper state.
     *
     * Actual channel cleanup happens through leave().
     */
    destroy() {
      handlers = {};

      streamChannel = null;

      streamChunks.clear();
    },
  };
}

/**
 * Reassemble Agora RTC data-stream chunks.
 *
 * Expected format:
 *
 * messageId|chunkNumber|totalChunks|base64Payload
 *
 * If the payload is not chunked, it is returned directly.
 */
function decodeAgoraStreamPayload(
  payload: string,
  chunks: Map<
    string,
    {
      total: number;
      parts: Map<number, string>;
    }
  >,
): string | null {
  const match = payload.match(
    /^([^|]+)\|(\d+)\|(\d+)\|([\s\S]*)$/,
  );

  /**
   * Not a chunked message.
   */
  if (!match) {
    return payload;
  }

  const [, messageId, indexText, totalText, encoded] = match;

  const index = Number(indexText);
  const total = Number(totalText);

  if (
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    total < 1 ||
    index < 1 ||
    index > total
  ) {
    return null;
  }

  const current =
    chunks.get(messageId) ??
    {
      total,
      parts: new Map<number, string>(),
    };

  /**
   * If a new chunk sequence arrives with a different total,
   * reset the previous partial message.
   */
  if (current.total !== total) {
    current.total = total;
    current.parts.clear();
  }

  current.parts.set(index, encoded);

  chunks.set(messageId, current);

  /**
   * Wait until every chunk arrives.
   */
  if (current.parts.size !== total) {
    return null;
  }

  const joined = Array.from(
    { length: total },
    (_, partIndex) =>
      current.parts.get(partIndex + 1) ?? '',
  ).join('');

  chunks.delete(messageId);

  try {
    const binary = atob(joined);

    const bytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0),
    );

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Stub implementation used when Agora is not configured.
 */
function createStubRtcClient(): IAgoraRtcClient {
  let muted = false;

  let handlers: RtcEventHandlers = {};

  return {
    getRawClient() {
      return null;
    },

    async join() {
      /**
       * Simulate connection for demo mode.
       */
      await new Promise((resolve) =>
        setTimeout(resolve, 300),
      );

      handlers.onConnectionStateChanged?.(
        'CONNECTED',
        'stub-join',
      );
    },

    async leave() {
      handlers.onConnectionStateChanged?.(
        'DISCONNECTED',
        'stub-leave',
      );
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

    on(newHandlers: RtcEventHandlers) {
      handlers = newHandlers;
    },

    off() {
      handlers = {};
    },

    sendStreamMessage() {
      // no-op in stub mode
    },

    getRemoteAudioLevel() {
      return 0;
    },

    destroy() {
      handlers = {};
    },
  };
}
