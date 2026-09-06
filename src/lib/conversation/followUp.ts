import type { FollowUpRequest, FollowUpRequestType, ProspectInfo } from '@/types/conversation';
import { emptyFollowUp } from '@/types/conversation';

const DEMO_PATTERN =
  /\b(?:book|schedule|want|need|request|set up|setup|arrange).{0,24}demo\b|\bdemo\b.{0,24}(?:please|with (?:someone|a person|sales)|call)|(?:product|sales)\s+demo\b/i;

const HUMAN_PATTERN =
  /\b(?:speak|talk|connect(?: me)?|put me through|transfer|get me).{0,20}(?:a\s+)?(?:human|person|representative|specialist|someone from sales)\b|\b(?:human|real)\s+(?:sales\s+)?(?:representative|rep|agent|specialist|person)\b|\bsales\s+(?:specialist|representative|rep|person|team)\b|\bcallback\b|\bcall me back\b|\bfollow[ -]?up\b|\bsomeone from sales\b/i;

const TIME_PATTERN =
  /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)|\d{1,2}:\d{2})\b/i;

const DATE_PATTERN =
  /\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i;

const TIMEZONE_PATTERN =
  /\b(IST|EST|EDT|PST|PDT|CST|CDT|MST|MDT|GMT|UTC|BST|AEST|PT|ET|CT|MT|pacific(?: time)?|eastern(?: time)?|central(?: time)?|mountain(?: time)?|india(?:n)? standard time|asia\/kolkata|america\/new_york)\b/i;

export function detectFollowUpType(text: string): FollowUpRequestType | null {
  if (DEMO_PATTERN.test(text)) return 'demo';
  if (HUMAN_PATTERN.test(text)) return 'human';
  return null;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function mergeFollowUp(current: FollowUpRequest, patch: Partial<FollowUpRequest>): FollowUpRequest {
  return {
    ...current,
    ...patch,
  };
}

function hasSchedule(followUp: FollowUpRequest): boolean {
  return Boolean(followUp.preferredDate && followUp.preferredTime);
}

export interface FollowUpHandling {
  prospectPatch: Partial<ProspectInfo>;
  instruction: string | null;
  systemNote: string | null;
}

export function handleFollowUpTurn(
  text: string,
  current: ProspectInfo,
): FollowUpHandling | null {
  const type = detectFollowUpType(text);
  const dateMatch = text.match(DATE_PATTERN);
  const timeMatch = text.match(TIME_PATTERN);
  const tzMatch = text.match(TIMEZONE_PATTERN);
  const followUp = current.followUp ?? emptyFollowUp();

  const next = mergeFollowUp(followUp, {
    requestType: type ?? followUp.requestType,
    preferredDate: dateMatch?.[1] ?? followUp.preferredDate,
    preferredTime: timeMatch?.[1] ?? followUp.preferredTime,
    timezone: tzMatch?.[1] ?? followUp.timezone,
    rawText: type || dateMatch || timeMatch ? text.trim() : followUp.rawText,
  });

  const requestedNow = Boolean(type) && followUp.requestType === null;
  const scheduleUpdated =
    next.preferredDate !== followUp.preferredDate ||
    next.preferredTime !== followUp.preferredTime ||
    next.timezone !== followUp.timezone;

  if (!requestedNow && !scheduleUpdated && followUp.requestType === null) {
    return null;
  }

  if (requestedNow && !hasSchedule(next)) {
    const kind = next.requestType === 'demo' ? 'a product demo' : 'a human sales specialist';
    return {
      prospectPatch: {
        followUp: next,
        escalationStatus: 'requested',
        leadStatus: 'escalated',
      },
      instruction: `The customer requested ${kind}. Acknowledge the request. Do NOT claim a meeting is booked. Do NOT claim a human is connected. Do NOT claim an email was sent. Ask: "Absolutely. I can request ${kind} to follow up with you. What date and time would work best for you?" Then, if they do not mention a timezone, ask which timezone to use.`,
      systemNote:
        next.requestType === 'demo'
          ? 'Demo follow-up requested. Waiting for preferred date and time.'
          : 'Human follow-up requested. Waiting for preferred date and time.',
    };
  }

  if (next.requestType && hasSchedule(next) && !next.timezone) {
    const localTz = browserTimezone();
    return {
      prospectPatch: {
        followUp: { ...next, timezone: localTz },
        escalationStatus: 'requested',
        leadStatus: 'escalated',
      },
      instruction: `The customer provided a preferred date (${next.preferredDate}) and time (${next.preferredTime}) but no timezone. Confirm the details and mention you will record timezone as ${localTz} unless they specify another. Do NOT claim the meeting is booked. Do NOT claim a human is connected. Do NOT claim an email was sent.`,
      systemNote: 'Follow-up time recorded. Timezone assumed from the browser until confirmed.',
    };
  }

  if (next.requestType && hasSchedule(next) && !next.confirmed) {
    const label = next.requestType === 'demo' ? 'demo' : 'human sales follow-up';
    return {
      prospectPatch: {
        followUp: { ...next, confirmed: true },
        escalationStatus: 'requested',
        leadStatus: 'escalated',
      },
      instruction: `The customer provided follow-up details. Confirm that a ${label} request has been recorded for ${next.preferredDate} at ${next.preferredTime} (${next.timezone ?? 'timezone to be confirmed'}). Say: "Your follow-up request has been recorded. Our sales team can contact you at the requested time." Do NOT claim the meeting is booked. Do NOT claim a human is connected. Do NOT claim an email was sent.`,
      systemNote: 'Follow-up request recorded. No booking was created.',
    };
  }

  if (requestedNow || scheduleUpdated) {
    return {
      prospectPatch: {
        followUp: next,
        escalationStatus: next.requestType ? 'requested' : current.escalationStatus,
        leadStatus: next.requestType ? 'escalated' : current.leadStatus,
      },
      instruction: null,
      systemNote: null,
    };
  }

  return null;
}

export function followUpNextAction(followUp: FollowUpRequest): string | null {
  if (!followUp.requestType) return null;

  const kind = followUp.requestType === 'demo' ? 'Demo' : 'Human sales';
  if (followUp.preferredDate && followUp.preferredTime) {
    return `${kind} follow-up requested for ${followUp.preferredDate} at ${followUp.preferredTime}${followUp.timezone ? ` (${followUp.timezone})` : ''}. Contact the prospect at the requested time. This is a recorded request, not a confirmed booking.`;
  }

  return `${kind} follow-up requested. Obtain and confirm the prospect’s preferred date, time, and timezone.`;
}
