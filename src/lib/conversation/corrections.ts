import type { ProspectField, ProspectInfo } from '@/types/conversation';

export interface CorrectionResult {
  prospectPatch: Partial<ProspectInfo>;
  instruction: string | null;
  systemNote: string | null;
}

const FIELD_LABEL: Record<ProspectField, string> = {
  name: 'name',
  email: 'email',
  company: 'company',
  teamSize: 'team size',
};

const COUNT_KEY: Record<ProspectField, keyof ProspectInfo> = {
  name: 'nameCorrectionCount',
  email: 'emailCorrectionCount',
  company: 'companyCorrectionCount',
  teamSize: 'teamSizeCorrectionCount',
};

const VALUE_KEY: Record<ProspectField, keyof ProspectInfo> = {
  name: 'contactName',
  email: 'contactEmail',
  company: 'company',
  teamSize: 'teamSize',
};

function cleanValue(field: ProspectField, raw: string): string | null {
  const value = raw.replace(/['"]/g, '').replace(/[.,!?;:]+$/, '').trim();
  if (!value) return null;
  if (field === 'email') {
    const email = value.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
  }
  if (/^(?:wrong|incorrect|not|no|that|this)$/i.test(value)) return null;
  return value;
}

function extractReplacement(text: string, field: ProspectField): string | null {
  const patterns: RegExp[] = [];

  if (field === 'name') {
    patterns.push(
      /\b(?:my name is not\b.+?(?:it'?s|it is|my name is)\s+)([A-Za-z][A-Za-z' -]{0,60})/i,
      /\b(?:not\s+[A-Za-z][A-Za-z'-]*\.?\s+(?:it'?s|it is|my name is)\s+)([A-Za-z][A-Za-z' -]{0,60})/i,
      /\b(?:actually(?:\s+it'?s|\s+it is)?\s+)([A-Za-z][A-Za-z' -]{0,40})(?:\s*$|[.!?])/i,
      /\b(?:you can call me|call me)\s+([A-Za-z][A-Za-z' -]{0,40})/i,
      /\b(?:the correct name is|correct name is|name is)\s+([A-Za-z][A-Za-z' -]{0,40})/i,
    );
  }

  if (field === 'email') {
    patterns.push(
      /\b(?:email(?:\s+address)?\s+(?:is|should be)\s+)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    );
  }

  if (field === 'company') {
    patterns.push(
      /\b(?:company(?:\s+name)?\s+(?:is|should be)\s+)(['"]?[A-Za-z][\w&.\- ]{1,60})/i,
      /\b(?:it'?s|it is|we(?:'re| are) (?:called|named))\s+(['"]?[A-Za-z][\w&.\- ]{1,60})/i,
      /\b(?:the correct company(?: name)? is)\s+(['"]?[A-Za-z][\w&.\- ]{1,60})/i,
    );
  }

  if (field === 'teamSize') {
    patterns.push(
      /\b(?:team size(?: is| should be)?|we(?:'re| are)|we have)\s+([0-9][0-9+,–\- ]*(?:\+)?(?:\s*(?:to|-|–)\s*[0-9]+)?)(?:\s*(?:people|employees|members))?/i,
      /\b(1\s*[–-]\s*10|11\s*[–-]\s*50|51\s*[–-]\s*200|201\s*[–-]\s*500|500\+)\b/i,
    );
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1] ? cleanValue(field, match[1]) : null;
    if (candidate) return candidate;
  }

  return null;
}

function detectWrongField(text: string): ProspectField | null {
  const lower = text.toLowerCase();

  if (
    /\b(?:name is (?:wrong|incorrect)|wrong name|not my name|that(?:'s| is) not my name|you got (?:my )?name wrong)\b/.test(
      lower,
    )
  ) {
    return 'name';
  }

  if (
    /\b(?:email is (?:wrong|incorrect)|wrong email|that(?:'s| is) not my email|email address is (?:wrong|incorrect))\b/.test(
      lower,
    )
  ) {
    return 'email';
  }

  if (
    /\b(?:company(?: name)? is (?:wrong|incorrect)|wrong company|that(?:'s| is) not (?:my|our) company)\b/.test(
      lower,
    )
  ) {
    return 'company';
  }

  if (
    /\b(?:team size is (?:wrong|incorrect)|wrong team size|that(?:'s| is) not (?:my|our) team size)\b/.test(
      lower,
    )
  ) {
    return 'teamSize';
  }

  if (/\bmy name is not\b/.test(lower)) return 'name';
  if (/\b(?:my )?email is not\b/.test(lower)) return 'email';
  if (/\b(?:the )?company name is not\b/.test(lower)) return 'company';
  if (/\b(?:our )?team size is not\b/.test(lower)) return 'teamSize';

  return null;
}

function isAffirmative(text: string): boolean {
  return /^(?:yes|yeah|yep|correct|right|that's right|that is right|that's correct|confirmed)\b/i.test(
    text.trim(),
  );
}

function isNegative(text: string): boolean {
  return /^(?:no|nope|not quite|that's not|that is not|incorrect|wrong)\b/i.test(
    text.trim(),
  );
}

function confirmationInstruction(field: ProspectField, value: string): string {
  return `I want to make sure I have that right. Your ${FIELD_LABEL[field]} is ${value}, correct?`;
}

function applyFieldUpdate(
  current: ProspectInfo,
  field: ProspectField,
  value: string,
): CorrectionResult {
  const countKey = COUNT_KEY[field];
  const previousCount = Number(current[countKey] ?? 0);
  const nextCount = previousCount + 1;
  const needsConfirm = nextCount >= 2;

  const prospectPatch: Partial<ProspectInfo> = {
    [VALUE_KEY[field]]: value,
    [countKey]: nextCount,
    pendingConfirmationField: needsConfirm ? field : null,
    pendingConfirmationValue: needsConfirm ? value : null,
  };

  if (needsConfirm) {
    return {
      prospectPatch,
      instruction: `The customer corrected their ${FIELD_LABEL[field]} again. The latest value is "${value}". Explicitly confirm before continuing. Say exactly: "${confirmationInstruction(field, value)}" Do not move on until they confirm.`,
      systemNote: `${FIELD_LABEL[field]} updated to ${value} and queued for confirmation.`,
    };
  }

  return {
    prospectPatch,
    instruction: `The customer corrected their ${FIELD_LABEL[field]} to "${value}". Acknowledge the update briefly and continue the conversation using only this latest value. Do not mention internal tracking.`,
    systemNote: `${FIELD_LABEL[field]} updated to ${value}.`,
  };
}

export function applyProspectCorrections(
  text: string,
  current: ProspectInfo,
): CorrectionResult | null {
  const normalized = text.trim();
  if (!normalized) return null;

  if (current.pendingConfirmationField && current.pendingConfirmationValue) {
    if (isAffirmative(normalized)) {
      return {
        prospectPatch: {
          pendingConfirmationField: null,
          pendingConfirmationValue: null,
        },
        instruction:
          'The customer confirmed the latest corrected information. Thank them briefly and continue. Do not re-ask the same field.',
        systemNote: `${FIELD_LABEL[current.pendingConfirmationField]} confirmed.`,
      };
    }

    if (isNegative(normalized)) {
      return {
        prospectPatch: {
          pendingConfirmationField: current.pendingConfirmationField,
          pendingConfirmationValue: null,
        },
        instruction: `The customer said the ${FIELD_LABEL[current.pendingConfirmationField]} is still not right. Ask for the correct ${FIELD_LABEL[current.pendingConfirmationField]}. Do not guess.`,
        systemNote: `Awaiting a new ${FIELD_LABEL[current.pendingConfirmationField]}.`,
      };
    }
  }

  const wrongField = detectWrongField(normalized);
  if (wrongField) {
    const replacement = extractReplacement(normalized, wrongField);
    if (replacement) {
      return applyFieldUpdate(current, wrongField, replacement);
    }

    return {
      prospectPatch: {},
      instruction: `The customer said their ${FIELD_LABEL[wrongField]} is wrong but did not provide the correct value. Ask for the correct ${FIELD_LABEL[wrongField]}. Do not invent a value.`,
      systemNote: `Asked for the correct ${FIELD_LABEL[wrongField]}.`,
    };
  }

  if (current.pendingConfirmationField && !current.pendingConfirmationValue) {
    const replacement = extractReplacement(normalized, current.pendingConfirmationField);
    if (replacement) {
      return applyFieldUpdate(current, current.pendingConfirmationField, replacement);
    }
  }

  return null;
}
