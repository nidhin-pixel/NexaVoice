import type { RTMClient } from 'agora-rtm';

export interface RtmSession {
  engine: RTMClient;
  logout(): Promise<void>;
}

/**
 * Login to Agora RTM with the same UID used for RTC.
 * Failures are returned as null so the voice path can continue.
 */
export async function startRtmSession(
  appId: string,
  userId: string,
  token?: string,
): Promise<RtmSession | null> {
  try {
    const module = await import('agora-rtm');
    const RtmConstructor = module.RTMClient;

    const engine = new RtmConstructor(appId, String(userId));
    await engine.login({ token });

    return {
      engine,
      async logout() {
        try {
          await engine.logout();
        } catch {
          // Best-effort RTM cleanup.
        }
      },
    };
  } catch {
    return null;
  }
}
