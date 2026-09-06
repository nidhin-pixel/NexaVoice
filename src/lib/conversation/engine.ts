import type { ProductPlan, ProductPlanId } from '@/data/products';
import { getPlanById } from '@/data/products';

import type {
  InterestLevel,
  LeadStatus,
  ProspectInfo,
} from '@/types/conversation';

export interface ParseResult {
  prospectPatch: Partial<ProspectInfo>;
  contactNameSource: ContactNameSource | null;
  detectedIntent: string | null;
  detectedPlanInterest: ProductPlanId | null;
  escalate: boolean;
}

/**
 * Reliability of a name supplied in one customer turn.
 */
export type ContactNameSource =
  | 'unknown'
  | 'uncertain_asr_guess'
  | 'reliable_context'
  | 'explicit_correction'
  | 'explicit_confirmation';

const TEAM_MEMBER_WORDS =
  '(?:people|employees|members|staff|seats|users|colleagues|devs|engineers|persons|person)';

const TEAM_SIZE_PATTERNS: RegExp[] = [
  new RegExp(`\\b(\\d+)\\s*${TEAM_MEMBER_WORDS}\\b`, 'i'),

  /\bteam\s*(?:of|size\s+of)?\s*(\d+)\b/i,

  new RegExp(
    `\\b(?:i|we)\\s+have\\s+(\\d+)\\s*${TEAM_MEMBER_WORDS}\\b`,
    'i',
  ),

  /\b(\d+)\s*[- ]?person\s+team\b/i,

  /\bjust\s+me\b/i,
  /\bsolo\b/i,
  /\bmyself\b/i,
];

const COMPANY_PATTERNS: RegExp[] = [
  /\b(?:company|org(?:anization)?|business|firm|agency|studio)\s+(?:is\s+)?(?:called|named|name(?:d)?|is)\s+['"]?([A-Za-z][\w&.-]*(?:\s+[A-Za-z][\w&.-]*){0,5})/i,

  /\bstartup\s+(?:called|named)\s+['"]?([A-Za-z][\w&.-]*(?:\s+[A-Za-z][\w&.-]*){0,5})/i,

  /\b(?:i(?:'m| am)\s+(?:from|with|at)|i\s+work\s+at)\s+['"]?([A-Za-z][\w&.-]*(?:\s+[A-Za-z][\w&.-]*){0,5})/i,

  /\b([A-Za-z][\w&.-]*(?:\s+[A-Za-z][\w&.-]*){0,5}?)\s*,?\s+(?:(?:which|that)\s+)?is\s+my\s+(?:company|org(?:anization)?|business|firm|agency|studio)\b/i,
];

const TEAM_SIZE_WORD_PATTERN =
  /\b(?:team\s*(?:size\s*)?(?:of\s*)?|team\s+has\s+|i\s+have\s+|we\s+have\s+)([a-z]+(?:[-\s][a-z]+)?)\s*(?:people|employees|members|staff|seats|users|colleagues|devs|engineers|persons|person)?\b/i;

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

const EMAIL_PATTERN =
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

const NAME_TOKEN =
  "[A-Za-z][A-Za-z'-]*(?:\\s+[A-Za-z][A-Za-z'-]*)?";

const NAME_PATTERN = new RegExp(
  `\\b(?:my name is|i(?:'m| am)|this is)\\s+(${NAME_TOKEN})(?=[.!?,;]|$)`,
  'i',
);

const NAME_CONFIRMATION_PATTERN = new RegExp(
  `^\\s*(?:yes|yeah|yep)\\s*,?\\s*(${NAME_TOKEN})\\s+(?:is\\s+)?(?:correct|right)\\b`,
  'i',
);

const NAME_CORRECTION_PATTERN = new RegExp(
  `^\\s*(?:no|actually|sorry)\\s*,\\s*(${NAME_TOKEN})(?=[.!?]|$)|(?:you got (?:my )?name wrong|that's not my name|that is not my name|i didn't say that|you got it wrong|wrong)\\s*[,.]?\\s*(?:it'?s|it is|my name is)\\s+(${NAME_TOKEN})(?=[.!?,;]|$)`,
  'i',
);

const COMMON_NON_NAMES = new Set([
  'sure',
  'yes',
  'yeah',
  'hello',
  'hi',
  'okay',
  'thanks',
  'thank',
  'nothing',
  'no',
  'maybe',
  'perhaps',
]);

function cleanCompanyCandidate(candidate: string): string | null {
  const value = candidate
    .trim()
    .split(/\s+(?:and|but|because|for|we|i)\b/i, 1)[0]
    .replace(/[.,!?;:]+$/, '')
    .replace(/\s+(?:for now|right now|at the moment)$/i, '')
    .trim();

  if (
    !value ||
    /^(?:not|nothing|anything|currently|we|our|i|don't|do not|no|and|or)\b/i.test(
      value,
    ) ||
    /\b(?:not doing|don't use|do not use|doing nothing)\b/i.test(value)
  ) {
    return null;
  }

  return value;
}

function normalizeTeamSize(value: string): string | null {
  const normalized = value
    .toLowerCase()
    .replace(/-/g, ' ')
    .trim();

  if (/^\d+$/.test(normalized)) {
    const number = Number(normalized);
    return number > 0 ? String(number) : null;
  }

  const parts = normalized.split(/\s+/).filter(Boolean);

  if (!parts.length) return null;

  const numbers = parts.map((part) => NUMBER_WORDS[part]);

  if (numbers.some((number) => number === undefined)) {
    return null;
  }

  const total = numbers.reduce((sum, number) => sum + number, 0);

  return total > 0 ? String(total) : null;
}

function cleanNameCandidate(candidate: string): string | null {
  const value = candidate
    .trim()
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .replace(/\s+/g, ' ');

  if (
    !value ||
    COMMON_NON_NAMES.has(value.toLowerCase()) ||
    /^(?:not|no|that's not|that is not|i didn't say|you got (?:it|my name) wrong|wrong)\b/i.test(
      value,
    )
  ) {
    return null;
  }

  return value;
}

const USE_CASE_KEYWORDS: { regex: RegExp; label: string }[] = [
  { regex: /lead\s*(?:generation|gen|capture)/i, label: 'Lead generation' },
  { regex: /qualif/i, label: 'Lead qualification' },
  { regex: /cold\s*call/i, label: 'Outbound calling' },
  { regex: /inbound/i, label: 'Inbound handling' },
  { regex: /support|help\s*desk/i, label: 'Customer support' },
  { regex: /onboard/i, label: 'Customer onboarding' },
  { regex: /schedul|appoint|book/i, label: 'Appointment scheduling' },
  { regex: /demo|present/i, label: 'Product demos' },
  { regex: /upsell|cross\s*sell|renew/i, label: 'Account expansion' },
  { regex: /sdr|sales\s*dev/i, label: 'SDR automation' },
  {
    regex: /sales|sell|selling|prospect|pipeline|revenue/i,
    label: 'Sales automation',
  },
];

const REQUIREMENT_KEYWORDS: { regex: RegExp; label: string }[] = [
  {
    regex: /integrat|connect|api|webhook|crm|salesforce|hubspot|slack/i,
    label: 'CRM/Tool integrations',
  },
  {
    regex: /multi(?:lingual|language)|language|spanish|hindi|french/i,
    label: 'Multilingual support',
  },
  {
    regex: /analytic|report|dashboard|insight/i,
    label: 'Analytics & reporting',
  },
  {
    regex: /escalat|human|handoff|transfer/i,
    label: 'Human escalation',
  },
  {
    regex: /custom|brand|white\s*label/i,
    label: 'Custom branding',
  },
  {
    regex: /secur|sso|complian|gdpr|hipaa/i,
    label: 'Security & compliance',
  },
  {
    regex: /scale|volume|high\s*call|thousands/i,
    label: 'High call volume',
  },
  {
    regex: /realtime|real-time|live/i,
    label: 'Real-time conversation',
  },
  {
    regex: /record|transcript|log/i,
    label: 'Call recording & transcripts',
  },
];

const INTEREST_SIGNALS = {
  high: [
    /(?:sign\s*up|start\s*(?:today|now)|onboard|implement|trial|demo|get\s*started)/i,
    /(?:love|great|perfect|exactly|sounds\s*(?:good|great|amazing))/i,
    /(?:budget|afford|price\s*(?:is|looks)\s*(?:fine|ok|good|reasonable)|worth)/i,
    /(?:ready|move\s*forward|next\s*steps|proposal|quote)/i,
  ],

  medium: [
    /(?:interested|consider|looking\s*into|explore|evaluate)/i,
    /(?:maybe|perhaps|might|could\s*work|seems\s*(?:good|nice))/i,
    /(?:more\s*info|learn\s*more|tell\s*me\s*more|details)/i,
    /(?:compare|options|plans)/i,
  ],

  low: [
    /(?:expensive|costly|too\s*much|over\s*budget|can'?t\s*afford)/i,
    /(?:not\s*(?:sure|interested)|pass|later|maybe\s*later|not\s*now)/i,
    /(?:just\s*looking|browsing|research)/i,
  ],
};

const PLAN_MENTIONS: { regex: RegExp; plan: ProductPlanId }[] = [
  { regex: /\bstarter\b/i, plan: 'starter' },
  { regex: /\bbusiness\b/i, plan: 'business' },
  { regex: /\benterprise\b/i, plan: 'enterprise' },
];

const ESCALATE_PATTERNS = [
  /human|person|agent|representative|someone\s*real|talk\s*to\s*(?:a\s*)?(?:human|person|real)/i,
  /escalat|transfer|manager|supervisor/i,
  /speak\s*to\s*(?:a\s*)?(?:human|person|someone)/i,
];

export function parseCustomerMessage(
  text: string,
  current: ProspectInfo,
): ParseResult {
  const patch: Partial<ProspectInfo> = {};

  let contactNameSource: ContactNameSource | null = null;
  let detectedIntent: string | null = null;
  let detectedPlanInterest: ProductPlanId | null = null;
  let escalate = false;

  const normalizedText = text.trim();

  // ------------------------------------------------------------
  // Escalation
  // ------------------------------------------------------------

  if (ESCALATE_PATTERNS.some((regex) => regex.test(normalizedText))) {
    escalate = true;
    patch.escalationStatus = 'requested';
  }

  // ------------------------------------------------------------
  // Company
  // ------------------------------------------------------------

  for (const regex of COMPANY_PATTERNS) {
    const match = normalizedText.match(regex);
    const company = match?.[1]
      ? cleanCompanyCandidate(match[1])
      : null;

    if (company) {
      patch.company = company.replace(/['"]/g, '').trim();
      break;
    }
  }

  // ------------------------------------------------------------
  // Contact name
  // ------------------------------------------------------------

  const correction = normalizedText.match(NAME_CORRECTION_PATTERN);
  const confirmation = normalizedText.match(NAME_CONFIRMATION_PATTERN);
  const explicitIdentity = normalizedText.match(NAME_PATTERN);

  let candidate: string | null = null;

  if (correction?.[1] || correction?.[2]) {
    candidate = correction[1] ?? correction[2] ?? null;
    contactNameSource = 'explicit_correction';
  } else if (confirmation?.[1]) {
    candidate = confirmation[1];
    contactNameSource = 'explicit_confirmation';
  } else if (explicitIdentity?.[1]) {
    candidate = explicitIdentity[1];

    // "My name is Nidhi", "I'm Nidhi", and "This is Nidhi"
    // are reliable identity statements, but not confirmations.
    contactNameSource = 'reliable_context';
  }

  const name = candidate ? cleanNameCandidate(candidate) : null;

  if (name) {
    patch.contactName = name;
  } else {
    contactNameSource = null;
  }

  // ------------------------------------------------------------
  // Email
  // ------------------------------------------------------------

  if (!current.contactEmail) {
    const match = normalizedText.match(EMAIL_PATTERN);

    if (match?.[1]) {
      patch.contactEmail = match[1].trim();
    }
  }

  // ------------------------------------------------------------
  // Team size
  // ------------------------------------------------------------

  for (const regex of TEAM_SIZE_PATTERNS) {
    const match = normalizedText.match(regex);

    if (!match) continue;

    if (/just\s+me|solo|myself/i.test(match[0])) {
      patch.teamSize = '1';
      break;
    }

    if (match[1]) {
      const teamSize = normalizeTeamSize(match[1]);

      if (teamSize) {
        patch.teamSize = teamSize;
      }

      break;
    }
  }

  // Handle number words such as:
  // "thirty people"
  // "team of thirty"
  // "we have thirty employees"
  // "team has thirty people"
  if (!patch.teamSize) {
    const wordMatch = normalizedText.match(TEAM_SIZE_WORD_PATTERN);

    if (wordMatch?.[1]) {
      const teamSize = normalizeTeamSize(wordMatch[1]);

      if (teamSize) {
        patch.teamSize = teamSize;
      }
    }
  }

  // Additional direct number-word handling for common natural phrasing.
  if (!patch.teamSize) {
    const directWordMatch = normalizedText.match(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:\s+(?:people|employees|members|staff|seats|users|colleagues|devs|engineers|persons|person))\b/i,
    );

    if (directWordMatch?.[1]) {
      const teamSize = normalizeTeamSize(directWordMatch[1]);

      if (teamSize) {
        patch.teamSize = teamSize;
      }
    }
  }

  // ------------------------------------------------------------
  // Use case
  // ------------------------------------------------------------

  if (!current.useCase) {
    for (const { regex, label } of USE_CASE_KEYWORDS) {
      if (regex.test(normalizedText)) {
        patch.useCase = label;
        detectedIntent = label;
        break;
      }
    }
  }

  // ------------------------------------------------------------
  // Requirements
  // ------------------------------------------------------------

  const newRequirements: string[] = [];

  for (const { regex, label } of REQUIREMENT_KEYWORDS) {
    if (
      regex.test(normalizedText) &&
      !current.requirements.includes(label)
    ) {
      newRequirements.push(label);
    }
  }

  if (newRequirements.length) {
    patch.requirements = [
      ...current.requirements,
      ...newRequirements,
    ];
  }

  // ------------------------------------------------------------
  // Direct plan mentions
  // ------------------------------------------------------------

  for (const { regex, plan } of PLAN_MENTIONS) {
    if (regex.test(normalizedText)) {
      detectedPlanInterest = plan;
      break;
    }
  }

  // ------------------------------------------------------------
  // Interest level
  // ------------------------------------------------------------

  const interest = detectInterest(
    normalizedText,
    current.interestLevel,
  );

  if (interest !== current.interestLevel) {
    patch.interestLevel = interest;
  }

  return {
    prospectPatch: patch,
    contactNameSource,
    detectedIntent,
    detectedPlanInterest,
    escalate,
  };
}

function detectInterest(
  text: string,
  current: InterestLevel,
): InterestLevel {
  const rank: Record<InterestLevel, number> = {
    unknown: 0,
    low: 1,
    medium: 2,
    high: 3,
  };

  let best: InterestLevel = current;

  for (const regex of INTEREST_SIGNALS.high) {
    if (regex.test(text) && rank.high > rank[best]) {
      best = 'high';
    }
  }

  for (const regex of INTEREST_SIGNALS.medium) {
    if (regex.test(text) && rank.medium > rank[best]) {
      best = 'medium';
    }
  }

  for (const regex of INTEREST_SIGNALS.low) {
    if (regex.test(text) && rank.low > rank[best]) {
      best = 'low';
    }
  }

  return best;
}

export function recommendPlan(
  prospect: ProspectInfo,
): ProductPlan | null {
  const teamSize = parseInt(prospect.teamSize ?? '0', 10);

  // Team-size based recommendation is authoritative.
  if (teamSize > 0) {
    if (teamSize <= 10) {
      return getPlanById('starter') ?? null;
    }

    if (teamSize <= 50) {
      return getPlanById('business') ?? null;
    }

    return getPlanById('enterprise') ?? null;
  }

  // Requirements-based recommendation.
  const requirementCount = prospect.requirements.length;

  if (
    prospect.useCase &&
    (requirementCount >= 2 ||
      prospect.interestLevel === 'high')
  ) {
    return getPlanById('business') ?? null;
  }

  if (prospect.useCase && requirementCount >= 1) {
    return getPlanById('starter') ?? null;
  }

  return null;
}

export function qualifyLead(
  prospect: ProspectInfo,
): LeadStatus {
  if (
    prospect.escalationStatus === 'requested' ||
    prospect.escalationStatus === 'in_progress'
  ) {
    return 'escalated';
  }

  const hasCompany = Boolean(prospect.company);
  const hasTeamSize = Boolean(prospect.teamSize);
  const hasUseCase = Boolean(prospect.useCase);
  const hasInterest =
    prospect.interestLevel !== 'unknown';
  const hasRequirements =
    prospect.requirements.length > 0;

  const signals = [
    hasCompany,
    hasTeamSize,
    hasUseCase,
    hasInterest,
    hasRequirements,
  ].filter(Boolean).length;

  if (
    signals >= 4 &&
    (prospect.interestLevel === 'high' ||
      prospect.interestLevel === 'medium')
  ) {
    return 'qualified';
  }

  if (
    signals <= 1 &&
    prospect.interestLevel === 'low'
  ) {
    return 'unqualified';
  }

  return 'discovering';
}

export function estimateDealValue(
  prospect: ProspectInfo,
): number | null {
  const plan = recommendPlan(prospect);

  if (!plan) {
    return null;
  }

  return plan.priceMonthly;
}

export function buildSummary(
  prospect: ProspectInfo,
): string {
  const parts: string[] = [];

  if (prospect.company) {
    parts.push(`Company: ${prospect.company}`);
  }

  if (prospect.teamSize) {
    parts.push(`Team size: ${prospect.teamSize}`);
  }

  if (prospect.useCase) {
    parts.push(`Use case: ${prospect.useCase}`);
  }

  if (prospect.requirements.length) {
    parts.push(
      `Requirements: ${prospect.requirements.join(', ')}`,
    );
  }

  const plan = recommendPlan(prospect);

  if (plan) {
    parts.push(`Recommended plan: ${plan.name}`);
  }

  parts.push(`Interest: ${prospect.interestLevel}`);

  return parts.join(' · ');
}

export function nextAction(
  prospect: ProspectInfo,
  leadStatus: LeadStatus,
): string {
  if (prospect.escalationStatus === 'requested') {
    return 'Route to human sales rep for escalation';
  }

  if (leadStatus === 'qualified') {
    return 'Sales follow-up — send proposal & schedule demo';
  }

  if (leadStatus === 'unqualified') {
    return 'Nurture sequence — re-engage later';
  }

  return 'Continue discovery — collect more prospect details';
}