import type { RTMClient } from 'agora-rtm';

export interface RtmSession {
  engine: RTMClient;
  logout(): Promise<void>;
}

/**
 * Login to Agora RTM with the same UID used for RTC, then subscribe to the
 * RTC channel. With `data_channel: "rtm"` + `enable_rtm`, the Conversational
 * AI agent delivers live transcript messages and agent-state (presence)
 * events on that channel — subscribing is required or no live events arrive.
 *
 * Failures are returned as null so the voice path can continue, but they are
 * logged (never swallowed silently).
 */
export async function startRtmSession(
  appId: string,
  userId: string,
  token: string | undefined,
  channelName: string,
): Promise<RtmSession | null> {
  try {
    const module = await import('agora-rtm');
    // The agora-rtm (RTM2) package exposes the client class as the `RTM`
    // property of its default export at runtime:
    //   import AgoraRTM from 'agora-rtm';
    //   const rtm = new AgoraRTM.RTM(appId, userId);
    // `RTMClient` is only a type-level name in the package's .d.ts — the
    // bundled runtime does not export it as a key.
    const namespace = (module as { default?: unknown }).default ?? module;
    const RtmConstructor =
      (namespace as { RTM?: unknown }).RTM ??
      (namespace as { RTMClient?: unknown }).RTMClient;

    if (typeof RtmConstructor !== 'function') {
      console.warn('[RTM] constructor missing — agora-rtm runtime has no RTM/RTMClient export');
      return null;
    }

    const engine = new (RtmConstructor as new (
      appId: string,
      userId: string,
    ) => RTMClient)(appId, String(userId));
    console.log('[RTM] constructor ok', { appId: Boolean(appId), userId });

    // Temporary diagnostics: log the RTM lifecycle and every raw incoming
    // event so a live call can verify the full path end-to-end.
    engine.addEventListener('message', (event) => {
      console.log('[RTM] message received', {
        channelType: event?.channelType,
        channelName: event?.channelName,
        publisher: event?.publisher,
        messageType: event?.messageType,
        sample:
          typeof event?.message === 'string'
            ? event.message.slice(0, 300)
            : event?.message,
      });
    });
    engine.addEventListener('presence', (event) => {
      console.log('[RTM] presence event', {
        channelName: event?.channelName,
        publisher: event?.publisher,
        stateChanged: event?.stateChanged,
      });
    });

    await engine.login({ token });
    console.log('[RTM] login ok', { userId });

    // Required: the agent publishes transcript + presence events to this
    // channel. Without subscribe() neither ever reaches the browser.
    await engine.subscribe(channelName, { withMessage: true, withPresence: true });
    console.log('[RTM] subscribe ok', { channelName, withMessage: true, withPresence: true });

    return {
      engine,
      async logout() {
        try {
          await engine.logout();
        } catch (err) {
          console.warn('[RTM] logout error', err);
        }
      },
    };
  } catch (err) {
    console.warn('[RTM] session failed', err);
    return null;
  }
}