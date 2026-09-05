import type { AgoraConfig } from '@/types/conversation';

const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const AGORA_API_BASE =
  (import.meta.env.VITE_AGORA_API_BASE as string | undefined) ??
  (SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1` : '');

export interface AgoraRuntimeConfig {
  appId: string;
  apiBase: string;
  hasCredentials: boolean;
}

export function getAgoraRuntimeConfig(): AgoraRuntimeConfig {
  const appId = (AGORA_APP_ID ?? '').trim();
  const apiBase = (AGORA_API_BASE ?? '').trim();
  return {
    appId,
    apiBase,
    hasCredentials: Boolean(appId && apiBase),
  };
}

export function isAgoraConfigured(): boolean {
  return getAgoraRuntimeConfig().hasCredentials;
}

/**
 * Fetches a real Agora RTC token + channel assignment from our server endpoint.
 * In production this calls our Edge Function which mints a token server-side.
 * A null result is only returned when Agora is not configured. Once configured,
 * API errors are surfaced so a production deployment never silently simulates.
 */
export async function fetchAgoraToken(channelName: string): Promise<AgoraConfig | null> {
  const cfg = getAgoraRuntimeConfig();
  if (!cfg.hasCredentials) return null;

  try {
    const res = await fetch(`${cfg.apiBase}/agora-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'token', channelName }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Unable to mint Agora token');
    const data = (await res.json()) as Partial<AgoraConfig>;
    if (!data.appId || !data.token || !data.channelName) return null;
    return {
      appId: data.appId,
      channelName: data.channelName,
      token: data.token,
      uid: data.uid ?? 0,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Unable to mint Agora token');
  }
}
