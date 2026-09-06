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

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .insert({
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
      followup_request_type: followUp.requestType,
      followup_date: followUp.preferredDate,
      followup_time: followUp.preferredTime,
      followup_timezone: followUp.timezone,
      followup_confirmed: followUp.confirmed,
    })
    .select('id')
    .single();

  if (conversationError) {
    throw conversationError;
  }

  const { error: leadError } = await supabase.from('leads').insert({
    conversation_id: conversation.id,
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
    followup_request_type: followUp.requestType,
    followup_date: followUp.preferredDate,
    followup_time: followUp.preferredTime,
    followup_timezone: followUp.timezone,
  });

  if (leadError) {
    throw leadError;
  }
}
