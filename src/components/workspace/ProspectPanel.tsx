import {
  Building2,
  User,
  Mail,
  Users,
  Target,
  ListChecks,
  Star,
  IndianRupee,
  TrendingUp,
  Tag,
  AlertCircle,
  Database,
} from 'lucide-react';
import type { ProspectInfo, LeadStatus, InterestLevel, EscalationStatus } from '@/types/conversation';
import { getPlanById, formatPrice } from '@/data/products';

interface ProspectPanelProps {
  prospect: ProspectInfo;
  isConnected: boolean;
}

export function ProspectPanel({ prospect, isConnected }: ProspectPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <h2 className="text-sm font-semibold text-white">Prospect Intelligence</h2>
        <span className="text-xs text-ink-500">
          {isConnected ? 'Updating live' : 'Awaiting conversation'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Company & Contact */}
        <Section title="Company & Contact">
          <InfoRow icon={Building2} label="Company" value={prospect.company} />
          <InfoRow icon={User} label="Contact Name" value={prospect.contactName} />
          <InfoRow icon={Mail} label="Email" value={prospect.contactEmail} />
          <InfoRow icon={Users} label="Team Size" value={prospect.teamSize} />
        </Section>

        {/* Use Case & Requirements */}
        <Section title="Discovery">
          <InfoRow icon={Target} label="Use Case" value={prospect.useCase} />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <ListChecks className="h-3.5 w-3.5" />
              Requirements
            </div>
            {prospect.requirements.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {prospect.requirements.map((req) => (
                  <span
                    key={req}
                    className="chip bg-brand-500/10 text-brand-300 animate-fade-in-fast"
                  >
                    {req}
                  </span>
                ))}
              </div>
            ) : (
              <EmptyValue label="Not yet identified" />
            )}
          </div>
        </Section>

        {/* Sales Intelligence */}
        <Section title="Sales Intelligence">
          <InterestRow level={prospect.interestLevel} />
          <InfoRow
            icon={Star}
            label="Recommended Plan"
            value={
              prospect.recommendedPlan
                ? getPlanById(prospect.recommendedPlan)?.name
                : null
            }
            valueClass="text-brand-300"
          />
          <InfoRow
            icon={IndianRupee}
            label="Est. Deal Value"
            value={
              prospect.estimatedDealValue
                ? formatPrice(getPlanById(prospect.recommendedPlan ?? 'starter')!)
                : null
            }
            valueClass="text-success-400"
          />
          <LeadStatusRow status={prospect.leadStatus} />
          <EscalationRow status={prospect.escalationStatus} />
        </Section>

        {/* CRM Sync */}
        <Section title="CRM & Sales Action">
          <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
              <Database className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Sync to CRM</div>
              <div className="text-xs text-ink-500">
                {prospect.leadStatus === 'qualified'
                  ? 'Ready to sync — qualified prospect'
                  : 'Available after qualification'}
              </div>
            </div>
            <button
              disabled={prospect.leadStatus !== 'qualified'}
              className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors hover:bg-brand-500/30 disabled:opacity-40"
            >
              Sync
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({
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
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {value ? (
        <span className={`text-sm font-medium animate-fade-in-fast ${valueClass || 'text-white'}`}>
          {value}
        </span>
      ) : (
        <EmptyValue />
      )}
    </div>
  );
}

function EmptyValue({ label = '—' }: { label?: string }) {
  return <span className="text-sm text-ink-600">{label}</span>;
}

function InterestRow({ level }: { level: InterestLevel }) {
  const config: Record<InterestLevel, { label: string; color: string; bg: string; bars: number }> = {
    unknown: { label: 'Unknown', color: 'text-ink-400', bg: 'bg-ink-600', bars: 0 },
    low: { label: 'Low', color: 'text-error-400', bg: 'bg-error-500', bars: 1 },
    medium: { label: 'Medium', color: 'text-warning-400', bg: 'bg-warning-500', bars: 2 },
    high: { label: 'High', color: 'text-success-400', bg: 'bg-success-500', bars: 3 },
  };

  const c = config[level];
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <TrendingUp className="h-3.5 w-3.5" />
        Interest Level
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3 w-1.5 rounded-full ${i <= c.bars ? c.bg : 'bg-white/10'}`}
            />
          ))}
        </div>
        <span className={`text-sm font-medium ${c.color}`}>{c.label}</span>
      </div>
    </div>
  );
}

function LeadStatusRow({ status }: { status: LeadStatus }) {
  const config: Record<LeadStatus, { label: string; color: string; bg: string }> = {
    new: { label: 'New', color: 'text-ink-300', bg: 'bg-ink-500/20' },
    discovering: { label: 'Discovering', color: 'text-warning-400', bg: 'bg-warning-500/15' },
    qualified: { label: 'Qualified', color: 'text-success-400', bg: 'bg-success-500/15' },
    unqualified: { label: 'Unqualified', color: 'text-error-400', bg: 'bg-error-500/15' },
    escalated: { label: 'Escalated', color: 'text-warning-400', bg: 'bg-warning-500/15' },
  };

  const c = config[status];
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Tag className="h-3.5 w-3.5" />
        Lead Status
      </div>
      <span className={`chip ${c.bg} ${c.color} animate-fade-in-fast`}>{c.label}</span>
    </div>
  );
}

function EscalationRow({ status }: { status: EscalationStatus }) {
  const config: Record<EscalationStatus, { label: string; color: string; bg: string }> = {
    none: { label: 'None', color: 'text-ink-400', bg: 'bg-white/5' },
    requested: { label: 'Human Requested', color: 'text-warning-400', bg: 'bg-warning-500/15' },
    in_progress: { label: 'In Progress', color: 'text-brand-300', bg: 'bg-brand-500/15' },
    completed: { label: 'Completed', color: 'text-success-400', bg: 'bg-success-500/15' },
  };

  const c = config[status];
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <AlertCircle className="h-3.5 w-3.5" />
        Escalation
      </div>
      <span className={`chip ${c.bg} ${c.color} animate-fade-in-fast`}>{c.label}</span>
    </div>
  );
}
