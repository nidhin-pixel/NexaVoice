import { getSupabaseFunctionHeaders } from '@/lib/agora/config';
import type { ConversationSummary, EmailDeliveryStatus, FollowUpRequest } from '@/types/conversation';

export interface FollowUpEmailResult {
  status: EmailDeliveryStatus;
  error: string | null;
}

function apiBase(): string {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '');
  const override = (import.meta.env.VITE_AGORA_API_BASE as string | undefined)?.trim();
  return override || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '');
}

export async function sendFollowUpEmail(
  summary: ConversationSummary,
  followUp: FollowUpRequest,
): Promise<FollowUpEmailResult> {
  if (!followUp.requestType) {
    return { status: 'skipped', error: null };
  }

  const email = summary.prospect.contactEmail?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { status: 'failed', error: 'A valid email address was not collected, so a confirmation could not be sent.' };
  }

  const base = apiBase();
  if (!base) {
    return { status: 'not_configured', error: 'Email delivery is not configured for this environment.' };
  }

  try {
    const response = await fetch(`${base}/send-followup-email`, {
      method: 'POST',
      headers: getSupabaseFunctionHeaders(),
      body: JSON.stringify({
        to: email,
        name: summary.prospect.contactName,
        company: summary.prospect.company,
        requestType: followUp.requestType,
        preferredDate: followUp.preferredDate,
        preferredTime: followUp.preferredTime,
        timezone: followUp.timezone,
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      configured?: boolean;
      sent?: boolean;
    };

    if (response.status === 503 || body.configured === false) {
      return {
        status: 'not_configured',
        error: body.error ?? 'Email delivery is not configured. The follow-up request was still recorded.',
      };
    }

    if (response.status === 404) {
      return {
        status: 'not_configured',
        error: 'Email service is not deployed on Supabase. The follow-up request was still recorded.',
      };
    }

    if (!response.ok || body.sent === false) {
      return {
        status: 'failed',
        error: body.error ?? body.message ?? 'The confirmation email could not be sent. The follow-up request was still recorded.',
      };
    }

    return { status: 'sent', error: null };
  } catch (error) {
    return {
      status: 'failed',
      error:
        error instanceof Error
          ? error.message
          : 'The confirmation email could not be sent. The follow-up request was still recorded.',
    };
  }
}
