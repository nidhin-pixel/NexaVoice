import type { ProductPlan, ProductPlanId } from '@/data/products';
import { PRODUCT_PLANS, getPlanById } from '@/data/products';
import type {
  InterestLevel,
  LeadStatus,
  ProspectInfo,
} from '@/types/conversation';

export interface ParseResult {
  prospectPatch: Partial<ProspectInfo>;
  detectedIntent: string | null;
  detectedPlanInterest: ProductPlanId | null;
  escalate: boolean;
}

const TEAM_SIZE_PATTERNS: RegExp[] = [
  /(\d+)\s*(?:people|employees|members|staff|seats|users|colleagues|devs|engineers)/i,
  /team\s*(?:of|size)?\s*(\d+)/i,
  /(\d+)\s*person\s*team/i,
  /around\s*(\d+)/i,
  /about\s*(\d+)/i,
  /just\s*me/i,
  /solo/i,
  /myself/i,
];

const COMPANY_PATTERNS: RegExp[] = [
  /(?:company|org(?:anization)?|business|firm|startup|agency|studio)\s*(?:is\s*(?:called|named)?|name(?:d| is)?)\s*['"]?([A-Z][\w&.\- ]{1,40})['"]?/i,
  /(?:i(?:'m| am)\s*(?:from|with|at)\s+)([A-Z][\w&.\- ]{1,40})/i,
  /(?:we(?:'re| are)\s+)([A-Z][\w&.\- ]{1,40})/i,
  /(?:call(?:ed| name)?(?:d| is)?)\s*['"]?([A-Z][\w&.\- ]{1,40})['"]?/i,
];

const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
const NAME_PATTERN = /(?:my name is|i'm|i am|this is|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;

const USE_CASE_KEYWORDS: { regex: RegExp; label: string }[] = [
  { regex: /lead\s*(generation|gen|capture)/i, label: 'Lead generation' },
  { regex: /qualif/i, label: 'Lead qualification' },
  { regex: /cold\s*call/i, label: 'Outbound calling' },
  { regex: /inbound/i, label: 'Inbound handling' },
  { regex: /support|help\s*desk/i, label: 'Customer support' },
  { regex: /onboard/i, label: 'Customer onboarding' },
  { regex: /schedul|appoint|book/i, label: 'Appointment scheduling' },
  { regex: /demo|present/i, label: 'Product demos' },
  { regex: /upsell|cross\s*sell|renew/i, label: 'Account expansion' },
  { regex: /sdr|sales\s*dev/i, label: 'SDR automation' },
];

const REQUIREMENT_KEYWORDS: { regex: RegExp; label: string }[] = [
  { regex: /integrat|connect|api|webhook|crm|salesforce|hubspot|slack/i, label: 'CRM/Tool integrations' },
  { regex: /multi(?:lingual|language)|language|spanish|hindi|french/i, label: 'Multilingual support' },
  { regex: /analytic|report|dashboard|insight/i, label: 'Analytics & reporting' },
  { regex: /escalat|human|handoff|transfer/i, label: 'Human escalation' },
  { regex: /custom|brand|white\s*label/i, label: 'Custom branding' },
  { regex: /secur|sso|complian|gdpr|hipaa/i, label: 'Security & compliance' },
  { regex: /scale|volume|high\s*call|thousands/i, label: 'High call volume' },
  { regex: /realtime|real-time|live/i, label: 'Real-time conversation' },
  { regex: /record|transcript|log/i, label: 'Call recording & transcripts' },
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

export function parseCustomerMessage(text: string, current: ProspectInfo): ParseResult {
  const patch: Partial<ProspectInfo> = {};
  let detectedIntent: string | null = null;
  let detectedPlanInterest: ProductPlanId | null = null;
  let escalate = false;

  // Escalation
  if (ESCALATE_PATTERNS.some((r) => r.test(text))) {
    escalate = true;
    patch.escalationStatus = 'requested';
  }

  // Company
  if (!current.company) {
    for (const r of COMPANY_PATTERNS) {
      const m = text.match(r);
      if (m?.[1]) {
        patch.company = m[1].trim().replace(/['"]/g, '');
        break;
      }
    }
  }

  // Contact name
  if (!current.contactName) {
    const m = text.match(NAME_PATTERN);
    if (m?.[1]) patch.contactName = m[1].trim();
  }

  // Email
  if (!current.contactEmail) {
    const m = text.match(EMAIL_PATTERN);
    if (m?.[1]) patch.contactEmail = m[1].trim();
  }

  // Team size
  if (!current.teamSize) {
    for (const r of TEAM_SIZE_PATTERNS) {
      const m = text.match(r);
      if (m) {
        if (/just\s*me|solo|myself/i.test(m[0])) {
          patch.teamSize = '1';
        } else if (m[1]) {
          patch.teamSize = m[1];
        }
        break;
      }
    }
  }

  // Use case
  if (!current.useCase) {
    for (const { regex, label } of USE_CASE_KEYWORDS) {
      if (regex.test(text)) {
        patch.useCase = label;
        detectedIntent = label;
        break;
      }
    }
  }

  // Requirements
  const newReqs: string[] = [];
  for (const { regex, label } of REQUIREMENT_KEYWORDS) {
    if (regex.test(text) && !current.requirements.includes(label)) {
      newReqs.push(label);
    }
  }
  if (newReqs.length) {
    patch.requirements = [...current.requirements, ...newReqs];
  }

  // Plan mentions
  for (const { regex, plan } of PLAN_MENTIONS) {
    if (regex.test(text)) {
      detectedPlanInterest = plan;
      break;
    }
  }

  // Interest level
  const interest = detectInterest(text, current.interestLevel);
  if (interest !== current.interestLevel) {
    patch.interestLevel = interest;
  }

  return { prospectPatch: patch, detectedIntent, detectedPlanInterest, escalate };
}

function detectInterest(text: string, current: InterestLevel): InterestLevel {
  const rank: Record<InterestLevel, number> = { unknown: 0, low: 1, medium: 2, high: 3 };
  let best: InterestLevel = current;

  for (const r of INTEREST_SIGNALS.high) {
    if (r.test(text) && rank['high'] > rank[best]) best = 'high';
  }
  for (const r of INTEREST_SIGNALS.medium) {
    if (r.test(text) && rank['medium'] > rank[best]) best = 'medium';
  }
  for (const r of INTEREST_SIGNALS.low) {
    if (r.test(text) && rank['low'] > rank[best]) best = 'low';
  }
  return best;
}

export function recommendPlan(prospect: ProspectInfo): ProductPlan | null {
  const teamSize = parseInt(prospect.teamSize ?? '0', 10);

  // If customer explicitly mentioned a plan and team size fits, honor it
  if (teamSize > 0) {
    if (teamSize <= 10) return getPlanById('starter');
    if (teamSize <= 50) return getPlanById('business');
    return getPlanById('enterprise');
  }

  // Fall back to requirements-based recommendation
  const reqCount = prospect.requirements.length;
  if (reqCount >= 4 || prospect.interestLevel === 'high') return getPlanById('business');
  if (reqCount >= 1) return getPlanById('starter');
  return null;
}

export function qualifyLead(prospect: ProspectInfo): LeadStatus {
  if (prospect.escalationStatus === 'requested' || prospect.escalationStatus === 'in_progress') {
    return 'escalated';
  }

  const hasCompany = Boolean(prospect.company);
  const hasTeamSize = Boolean(prospect.teamSize);
  const hasUseCase = Boolean(prospect.useCase);
  const hasInterest = prospect.interestLevel !== 'unknown';
  const hasRequirements = prospect.requirements.length > 0;

  const signals = [hasCompany, hasTeamSize, hasUseCase, hasInterest, hasRequirements].filter(Boolean).length;

  if (signals >= 4 && (prospect.interestLevel === 'high' || prospect.interestLevel === 'medium')) {
    return 'qualified';
  }
  if (signals <= 1 && prospect.interestLevel === 'low') {
    return 'unqualified';
  }
  return 'discovering';
}

export function estimateDealValue(prospect: ProspectInfo): number | null {
  const plan = recommendPlan(prospect);
  if (!plan) return null;
  return plan.priceMonthly;
}

export function buildSummary(prospect: ProspectInfo): string {
  const parts: string[] = [];
  if (prospect.company) parts.push(`Company: ${prospect.company}`);
  if (prospect.teamSize) parts.push(`Team size: ${prospect.teamSize}`);
  if (prospect.useCase) parts.push(`Use case: ${prospect.useCase}`);
  if (prospect.requirements.length) parts.push(`Requirements: ${prospect.requirements.join(', ')}`);
  const plan = recommendPlan(prospect);
  if (plan) parts.push(`Recommended plan: ${plan.name}`);
  parts.push(`Interest: ${prospect.interestLevel}`);
  return parts.join(' · ');
}

export function nextAction(prospect: ProspectInfo, leadStatus: LeadStatus): string {
  if (prospect.escalationStatus === 'requested') return 'Route to human sales rep for escalation';
  if (leadStatus === 'qualified') return 'Sales follow-up — send proposal & schedule demo';
  if (leadStatus === 'unqualified') return 'Nurture sequence — re-engage later';
  return 'Continue discovery — collect more prospect details';
}
