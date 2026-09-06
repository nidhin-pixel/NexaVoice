import { PRODUCT_PLANS, formatPrice } from '@/data/products';
import type { ProspectInfo } from '@/types/conversation';
import { recommendPlan } from '@/lib/conversation/engine';

export type ConversationPhase =
  | 'greeting'
  | 'discovery'
  | 'product_inquiry'
  | 'pricing_inquiry'
  | 'recommendation'
  | 'qualification'
  | 'closing'
  | 'escalation'
  | 'general';

export function detectPhase(text: string, prospect: ProspectInfo): ConversationPhase {
  const lower = text.toLowerCase().trim();

  if (/human|person|manager|supervisor|escalat|talk\s*to\s*(?:a\s*)?(?:real|human|person)/i.test(lower)) {
    return 'escalation';
  }
  if (/price|pricing|cost|how\s*much|plan|per\s*month|budget/i.test(lower)) {
    return 'pricing_inquiry';
  }
  if (/what\s*(?:does|can|do)\s*(?:it|you|nexavoice)|feature|capabilit|offer|service|product/i.test(lower)) {
    return 'product_inquiry';
  }
  if (prospect.company && prospect.teamSize && prospect.useCase) {
    return 'recommendation';
  }
  if (!prospect.contactName || !prospect.company || !prospect.teamSize || !prospect.useCase) {
    return 'discovery';
  }
  return 'general';
}

export function generateAgentResponse(
  customerText: string,
  prospect: ProspectInfo,
  phase: ConversationPhase,
): string {
  switch (phase) {
    case 'escalation':
      return handleEscalation();

    case 'pricing_inquiry':
      return handlePricingInquiry();

    case 'product_inquiry':
      return handleProductInquiry();

    case 'discovery':
      return handleDiscovery(prospect);

    case 'recommendation':
      return handleRecommendation(prospect);

    case 'qualification':
      return handleQualification(prospect);

    case 'closing':
      return handleClosing();

    default:
      return handleGeneral(customerText);
  }
}

function handleEscalation(): string {
  return "Absolutely — I can help arrange the next step with a human sales specialist. I'll keep the details from this conversation available for them. What would be most useful for the specialist to know?";
}

function handlePricingInquiry(): string {
  const lines = PRODUCT_PLANS.map(
    (p) => `${p.name} at ${formatPrice(p)} for up to ${p.maxUsers} users.`,
  );
  return `Great question. We have three plans. ${lines.join(' ')} Based on what you've told me, I can recommend the best fit once I understand your team size and use case a bit more. How many people would be using this?`;
}

function handleProductInquiry(): string {
  return "NexaVoice is a real-time AI voice sales agent. When a customer calls in, the AI has a natural two-way voice conversation — it listens, understands requirements, answers product and pricing questions, recommends the right plan, and qualifies the lead. All of that happens live, and your sales team gets a full prospect intelligence report. What's your current sales process like? Are you doing inbound, outbound, or both?";
}

function handleDiscovery(prospect: ProspectInfo): string {
  if (!prospect.contactName) {
    return "Thanks for taking the call. May I know your name?";
  }
  if (!prospect.company) {
    return `Nice to meet you, ${prospect.contactName}. Which organization or company are you with?`;
  }
  if (!prospect.useCase) {
    return "Thanks. What are you looking for NexaVoice to help you accomplish?";
  }
  if (!prospect.teamSize) {
    return "Thanks for sharing that. Roughly how many people would be on your team using NexaVoice?";
  }

  if (prospect.requirements.length === 0) {
    return "What would be most important for you in a solution — integrations, multilingual support, analytics, or something else?";
  }

  if (prospect.company && prospect.teamSize && prospect.useCase) {
    return "Thanks for sharing that. Let me make sure I've got the full picture before recommending a plan. Could you tell me a bit about what's most important to you — integrations, multilingual support, analytics, or anything else?";
  }
  return "Thanks for sharing. What else would be useful for us to understand about your needs?";
}

function handleRecommendation(prospect: ProspectInfo): string {
  const plan = recommendPlan(prospect);
  if (!plan) {
    return "Based on what you've shared, I'd like to understand your needs a bit more before recommending a plan. What features matter most to you?";
  }
  return `Based on what you've told me — ${summarizeProspect(prospect)} — I'd recommend our ${plan.name} plan at ${formatPrice(plan)}. It supports up to ${plan.maxUsers} users and includes ${plan.features.slice(0, 2).join(', ').toLowerCase()}. Does that sound like a good fit, or would you like to compare it with other plans?`;
}

function handleQualification(prospect: ProspectInfo): string {
  if (prospect.interestLevel === 'high') {
    return "That's great to hear. I think we're a strong fit for what you need. Would you like me to connect you with our sales team for next steps, or is there anything else I can answer for you right now?";
  }
  if (prospect.interestLevel === 'low') {
    return "I completely understand. No pressure at all. If it helps, I can share more details about how other teams in your situation have used NexaVoice, or we can revisit this later. What would be most helpful for you?";
  }
  return "Thanks for that context. Would you like me to walk you through how the plan works in more detail, or do you have any specific questions I can answer?";
}

function handleClosing(): string {
  return "Wonderful. I've captured all the details from our conversation — your company info, team size, use case, and the plan I recommended. Our sales team will follow up with you to get everything set up. Is there anything else I can help you with today?";
}

function handleGeneral(text: string): string {
  if (/thank|thanks|appreciate/i.test(text)) {
    return "You're very welcome! I'm glad I could help. Is there anything else you'd like to know about NexaVoice?";
  }
  if (/yes|yeah|sure|sounds\s*good/i.test(text)) {
    return "Great. To make sure I recommend the right plan, could you tell me how large your team is and what you're primarily looking to use NexaVoice for?";
  }
  if (/no|not\s*really|that'?s\s*all|nothing\s*else/i.test(text)) {
    return "No problem at all. Thanks for chatting with me today — I've saved all your details and our sales team will be in touch. Have a great day!";
  }
  return "That's a great point. To make sure I give you the best recommendation, could you tell me a bit more about your team size and what you're hoping to achieve with NexaVoice?";
}

function summarizeProspect(prospect: ProspectInfo): string {
  const parts: string[] = [];
  if (prospect.company) parts.push(`your team at ${prospect.company}`);
  if (prospect.teamSize) parts.push(`${prospect.teamSize} ${parseInt(prospect.teamSize) === 1 ? 'person' : 'people'}`);
  if (prospect.useCase) parts.push(`focused on ${prospect.useCase.toLowerCase()}`);
  return parts.join(', ');
}

export function greetingMessage(): string {
  return "Hi there, and welcome to NexaVoice! I'm your AI sales assistant. May I have your name?";
}
