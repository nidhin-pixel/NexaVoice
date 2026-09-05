import type { ProductPlan } from '@/data/products';
import { PRODUCT_PLANS, formatPrice, getPlanById } from '@/data/products';
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
      return handleEscalation(customerText, prospect);

    case 'pricing_inquiry':
      return handlePricingInquiry(customerText, prospect);

    case 'product_inquiry':
      return handleProductInquiry(customerText, prospect);

    case 'discovery':
      return handleDiscovery(customerText, prospect);

    case 'recommendation':
      return handleRecommendation(customerText, prospect);

    case 'qualification':
      return handleQualification(customerText, prospect);

    case 'closing':
      return handleClosing(customerText, prospect);

    default:
      return handleGeneral(customerText, prospect);
  }
}

function handleEscalation(_text: string, _prospect: ProspectInfo): string {
  return "Absolutely — I understand you'd like to speak with a human team member. I'm connecting you with our sales team right now. Everything we've discussed so far will be shared with them so you don't have to repeat yourself. They'll be with you shortly.";
}

function handlePricingInquiry(_text: string, _prospect: ProspectInfo): string {
  const lines = PRODUCT_PLANS.map(
    (p) => `${p.name} at ${formatPrice(p)} for up to ${p.maxUsers} users.`,
  );
  return `Great question. We have three plans. ${lines.join(' ')} Based on what you've told me, I can recommend the best fit once I understand your team size and use case a bit more. How many people would be using this?`;
}

function handleProductInquiry(_text: string, _prospect: ProspectInfo): string {
  return "NexaVoice is a real-time AI voice sales agent. When a customer calls in, the AI has a natural two-way voice conversation — it listens, understands requirements, answers product and pricing questions, recommends the right plan, and qualifies the lead. All of that happens live, and your sales team gets a full prospect intelligence report. What's your current sales process like? Are you doing inbound, outbound, or both?";
}

function handleDiscovery(text: string, prospect: ProspectInfo): string {
  const missing: string[] = [];
  if (!prospect.contactName) missing.push("your name");
  if (!prospect.company) missing.push("the name of your company");
  if (!prospect.useCase) missing.push("what you're primarily looking to use NexaVoice for");
  if (!prospect.teamSize) missing.push("how large your team is");

  if (missing.length === 0) {
    return "Thanks for sharing that. Let me make sure I've got the full picture before recommending a plan. Could you tell me a bit about what's most important to you — integrations, multilingual support, analytics, or anything else?";
  }

  if (missing.length === 3) {
    return "Welcome to NexaVoice! I'm your AI sales assistant. To get started, may I have your name and the name of your company?";
  }

  if (missing.length <= 2) {
    if (!prospect.contactName && !prospect.company) {
      return "Thanks for that. May I have your name and the name of your company?";
    }
    if (!prospect.contactName) {
      return "Thanks. May I have your name?";
    }
    if (!prospect.company) {
      return "Got it. And what's the name of your company?";
    }
    if (!prospect.useCase) {
      return "Perfect. What problem are you hoping NexaVoice will solve, and what would you like the agent to handle?";
    }
    if (!prospect.teamSize) {
      return "Thanks. Roughly how many people would be on your team using NexaVoice?";
    }
  }

  return `Thanks for sharing. I'd love to understand a bit more — could you tell me about ${missing[0]}?`;
}

function handleRecommendation(text: string, prospect: ProspectInfo): string {
  const plan = recommendPlan(prospect);
  if (!plan) {
    return "Based on what you've shared, I'd like to understand your needs a bit more before recommending a plan. What features matter most to you?";
  }
  return `Based on what you've told me — ${summarizeProspect(prospect)} — I'd recommend our ${plan.name} plan at ${formatPrice(plan)}. It supports up to ${plan.maxUsers} users and includes ${plan.features.slice(0, 2).join(', ').toLowerCase()}. Does that sound like a good fit, or would you like to compare it with other plans?`;
}

function handleQualification(text: string, prospect: ProspectInfo): string {
  if (prospect.interestLevel === 'high') {
    return "That's great to hear. I think we're a strong fit for what you need. Would you like me to connect you with our sales team for next steps, or is there anything else I can answer for you right now?";
  }
  if (prospect.interestLevel === 'low') {
    return "I completely understand. No pressure at all. If it helps, I can share more details about how other teams in your situation have used NexaVoice, or we can revisit this later. What would be most helpful for you?";
  }
  return "Thanks for that context. Would you like me to walk you through how the plan works in more detail, or do you have any specific questions I can answer?";
}

function handleClosing(text: string, prospect: ProspectInfo): string {
  return "Wonderful. I've captured all the details from our conversation — your company info, team size, use case, and the plan I recommended. Our sales team will follow up with you to get everything set up. Is there anything else I can help you with today?";
}

function handleGeneral(text: string, prospect: ProspectInfo): string {
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
  return "Hi there, and welcome to NexaVoice! I'm your AI sales assistant. May I start with your name and the name of your company?";
}
