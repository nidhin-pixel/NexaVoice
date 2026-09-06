import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { ConversationSummary } from '@/types/conversation';

export async function persistConversation(
  channelName: string | null,
  summary: ConversationSummary,
): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Conversation storage is not configured.');
  }

  const followUp = summary.followUp ?? summary.prospect.followUp;

  const baseConversation = {
    channel_name: channelName,
    started_at: new Date(summary.startedAt).toISOString(),
    ended_at: new Date(summary.endedAt).toISOString(),
    duration_seconds: summary.durationSeconds,
    transcript: summary.transcript,
    prospect: summary.prospect,
    summary_text: summary.summaryText,
    customer_requirements: summary.customerRequirements,
    recommended_plan: summary.recommendedPlan,
    lead_status: summary.leadStatus,
    interest_level: summary.interestLevel,
    estimated_deal_value: summary.estimatedDealValue,
    next_action: summary.nextAction,
    escalation_status: summary.escalationStatus,
  };

  let conversationId: string | null = null;

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
      ...baseConversation,
      followup_request_type: followUp.requestType,
      followup_date: followUp.preferredDate,
      followup_time: followUp.preferredTime,
      followup_timezone: followUp.timezone,
      followup_confirmed: followUp.confirmed,
    })
    .select('id')
    .single();

  if (conversationError) {
    if (conversationError.code === 'PGRST204' && conversationError.message?.includes('followup_')) {
      const { data: fallbackConv, error: fallbackError } = await supabase
        .from('conversations')
        .insert(baseConversation)
        .select('id')
        .single();
      if (fallbackError) {
        throw fallbackError;
      }
      conversationId = fallbackConv?.id ?? null;
    } else {
      throw conversationError;
    }
  } else {
    conversationId = conversation.id;
  }

  const baseLead = {
    conversation_id: conversationId,
    contact_name: summary.prospect.contactName,
    company: summary.prospect.company,
    contact_email: summary.prospect.contactEmail,
    team_size: summary.prospect.teamSize,
    use_case: summary.prospect.useCase,
    requirements: summary.customerRequirements,
    lead_status: summary.leadStatus,
    interest_level: summary.interestLevel,
    recommended_plan: summary.recommendedPlan,
    estimated_deal_value: summary.estimatedDealValue,
    escalation_status: summary.escalationStatus,
    next_action: summary.nextAction,
  };

  const { error: leadError } = await supabase.from('leads').insert({
    ...baseLead,
    followup_request_type: followUp.requestType,
    followup_date: followUp.preferredDate,
    followup_time: followUp.preferredTime,
    followup_timezone: followUp.timezone,
  });

  if (leadError) {
    if (leadError.code === 'PGRST204' && leadError.message?.includes('followup_')) {
      const { error: fallbackLeadError } = await supabase.from('leads').insert(baseLead);
      if (fallbackLeadError) {
        throw fallbackLeadError;
      }
    } else {
      throw leadError;
    }
  }
}
