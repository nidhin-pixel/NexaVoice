import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  Clock,
  User,
  Building2,
  Target,
  ListChecks,
  Star,
  IndianRupee,
  TrendingUp,
  Tag,
  ArrowRight,
  RotateCcw,
  Radio,
} from 'lucide-react';
import type { ConversationSummary } from '@/types/conversation';
import { getPlanById, formatPrice } from '@/data/products';
import { LeadHistoryPanel } from '@/components/workspace/LeadHistoryPanel';

interface PostCallSummaryProps {
  summary: ConversationSummary;
  onNewConversation: () => void;
}

export function PostCallSummary({ summary, onNewConversation }: PostCallSummaryProps) {
  const plan = summary.recommendedPlan ? getPlanById(summary.recommendedPlan) : null;
  const isQualified = summary.leadStatus === 'qualified';
  const isEscalated = summary.escalationStatus === 'requested' || summary.escalationStatus === 'in_progress';

  return (
    <div className="min-h-screen bg-ink-950 py-8">
      <div className="container-page max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
            <Phone className="h-8 w-8 text-white" strokeWidth={2} />
          </div>
          <h1 className="font-display text-3xl font-bold text-white">Conversation Summary</h1>
          <p className="mt-2 text-sm text-ink-400">
            Call ended · {formatDuration(summary.durationSeconds)}
          </p>
          <p className="mt-3 text-sm text-ink-300">
            Thanks for speaking with NexaVoice. Your conversation has been recorded.
          </p>
          {summary.followUp.requestType && (
            <p className="mt-1 text-sm text-brand-300">
              Your {summary.followUp.requestType === 'demo' ? 'demo' : 'human sales'} follow-up request was recorded.
            </p>
          )}
        </div>

        {/* Lead status banner */}
        <div
          className={`mb-6 flex items-center gap-4 rounded-2xl border p-5 animate-scale-in ${
            isQualified
              ? 'border-success-500/30 bg-success-500/5'
              : isEscalated
                ? 'border-warning-500/30 bg-warning-500/5'
                : 'border-white/10 bg-white/[0.02]'
          }`}
        >
          {isQualified ? (
            <CheckCircle2 className="h-8 w-8 text-success-400" />
          ) : isEscalated ? (
            <AlertCircle className="h-8 w-8 text-warning-400" />
          ) : (
            <XCircle className="h-8 w-8 text-ink-400" />
          )}
          <div className="flex-1">
            <div className="text-lg font-semibold text-white">
              {isQualified
                ? 'Qualified Lead'
                : isEscalated
                  ? 'Escalation Required'
                  : summary.leadStatus === 'unqualified'
                    ? 'Not Qualified'
                    : 'Discovery Incomplete'}
            </div>
            <div className="text-sm text-ink-400">{summary.nextAction}</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Clock className="h-4 w-4" />
            {formatDuration(summary.durationSeconds)}
          </div>
        </div>

        {/* Summary grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Prospect info */}
          <div className="card p-6 animate-slide-up">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <User className="h-4 w-4 text-brand-400" />
              Prospect Information
            </h2>
            <div className="space-y-3">
              <SummaryRow icon={Building2} label="Company" value={summary.prospect.company} />
              <SummaryRow icon={User} label="Contact" value={summary.prospect.contactName} />
              <SummaryRow icon={Target} label="Use Case" value={summary.prospect.useCase} />
              <SummaryRow
                icon={Tag}
                label="Lead Status"
                value={summary.leadStatus.charAt(0).toUpperCase() + summary.leadStatus.slice(1)}
              />
            </div>
          </div>

          {/* Requirements */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <ListChecks className="h-4 w-4 text-brand-400" />
              Customer Requirements
            </h2>
            {summary.customerRequirements.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {summary.customerRequirements.map((req) => (
                  <span key={req} className="chip bg-brand-500/10 text-brand-300">
                    {req}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-500">No specific requirements identified.</p>
            )}
          </div>

          {/* Recommendation */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <Star className="h-4 w-4 text-brand-400" />
              Recommended Plan
            </h2>
            {plan ? (
              <div>
                <div className="text-2xl font-bold text-brand-300">{plan.name}</div>
                <div className="mt-1 text-sm text-white">{formatPrice(plan)}</div>
                <div className="mt-1 text-xs text-ink-400">Up to {plan.maxUsers} users</div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-ink-500">No plan recommended — insufficient data.</p>
            )}
          </div>

          {/* Deal value & next action */}
          <div className="card p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <TrendingUp className="h-4 w-4 text-brand-400" />
              Deal & Next Action
            </h2>
            <div className="space-y-3">
              <SummaryRow
                icon={IndianRupee}
                label="Est. Deal Value"
                value={summary.estimatedDealValue ? formatPrice(plan!) : null}
                valueClass="text-success-400"
              />
              <SummaryRow
                icon={TrendingUp}
                label="Interest Level"
                value={summary.interestLevel.charAt(0).toUpperCase() + summary.interestLevel.slice(1)}
              />
              {summary.escalationStatus !== 'none' && (
                <SummaryRow
                  icon={Radio}
                  label="Escalation"
                  value={summary.escalationStatus === 'requested' ? 'Human Requested' : summary.escalationStatus}
                  valueClass="text-warning-400"
                />
              )}
              <div className="mt-4 rounded-xl border border-brand-500/20 bg-brand-500/5 p-3">
                <div className="flex items-start gap-2">
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                      Next Action
                    </div>
                    <div className="mt-1 text-sm text-white">{summary.nextAction}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript summary text */}
        <div className="card mt-6 p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <h2 className="mb-3 text-sm font-semibold text-white">Conversation Overview</h2>
          <p className="text-sm leading-relaxed text-ink-300">{summary.summaryText}</p>
          <div className="mt-4 border-t border-white/5 pt-4 text-xs text-ink-400">
            <div>
              Conversation save: {summary.persistStatus === 'saved' ? 'Completed' : 'Pending or failed'}
            </div>
            {summary.persistError && <div className="mt-1 text-error-400">{summary.persistError}</div>}
            {summary.followUp.requestType && (
              <div className="mt-1">
                Email status:{' '}
                {summary.emailStatus === 'sent'
                  ? 'Confirmation sent'
                  : summary.emailStatus === 'sending'
                    ? 'Sending confirmation'
                    : summary.emailStatus === 'not_configured'
                      ? 'Not configured; request was still recorded'
                      : 'Not sent; request was still recorded'}
              </div>
            )}
            {summary.emailError && <div className="mt-1 text-warning-400">{summary.emailError}</div>}
          </div>
        </div>

        <div className="mt-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
          <LeadHistoryPanel />
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button onClick={onNewConversation} className="btn-primary text-base">
            <RotateCcw className="h-5 w-5" strokeWidth={2} />
            Start New Conversation
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-ink-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className={`text-sm font-medium ${valueClass || 'text-white'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}
