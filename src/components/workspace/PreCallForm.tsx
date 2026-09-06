import { useMemo, useState } from 'react';
import { ArrowLeft, Building2, Mail, PhoneCall, User, Users } from 'lucide-react';
import { TEAM_SIZE_OPTIONS, isValidEmail, type PreCallProspect } from '@/data/precall';

interface PreCallFormProps {
  onBack: () => void;
  onStart: (prospect: PreCallProspect) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

interface FieldErrors {
  contactName?: string;
  contactEmail?: string;
  company?: string;
  teamSize?: string;
}

export function PreCallForm({ onBack, onStart, submitting = false, error }: PreCallFormProps) {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const isBusy = submitting;

  const canSubmit = useMemo(() => {
    return !isBusy;
  }, [isBusy]);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!contactName.trim()) next.contactName = 'Enter your full name.';
    if (!contactEmail.trim()) next.contactEmail = 'Enter your work email.';
    else if (!isValidEmail(contactEmail)) next.contactEmail = 'Enter a valid work email address.';
    if (!company.trim()) next.company = 'Enter your company or organization.';
    if (!teamSize) next.teamSize = 'Select your team size.';
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    await onStart({
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      company: company.trim(),
      teamSize: teamSize as PreCallProspect['teamSize'],
    });
  }

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white/5 hover:text-white"
            title="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="font-display text-sm font-bold text-white">NexaVoice</div>
            <div className="text-xs text-ink-500">Before you speak with Emily</div>
          </div>
        </div>
      </header>

      <main className="container-page flex min-h-[calc(100vh-57px)] items-center py-10">
        <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 text-center sm:text-left">
            <p className="section-eyebrow">Live conversation</p>
            <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
              Tell Emily who you are
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-400">
              These details are used during the call so Emily can personalize the conversation and
              update Prospect Intelligence from the start.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-8" noValidate>
            <Field
              id="full-name"
              label="Full name"
              icon={User}
              value={contactName}
              onChange={setContactName}
              error={submitted ? errors.contactName : undefined}
              autoComplete="name"
              placeholder="Rohan Sharma"
            />
            <Field
              id="work-email"
              label="Work email"
              icon={Mail}
              type="email"
              value={contactEmail}
              onChange={setContactEmail}
              error={submitted ? errors.contactEmail : undefined}
              autoComplete="email"
              placeholder="rohan@company.com"
            />
            <Field
              id="company"
              label="Company / Organization"
              icon={Building2}
              value={company}
              onChange={setCompany}
              error={submitted ? errors.company : undefined}
              autoComplete="organization"
              placeholder="Nexa Labs"
            />

            <div>
              <label htmlFor="team-size" className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-200">
                <Users className="h-4 w-4 text-brand-300" />
                Team size
              </label>
              <select
                id="team-size"
                value={teamSize}
                onChange={(event) => setTeamSize(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-400"
              >
                <option value="">Select team size</option>
                {TEAM_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {submitted && errors.teamSize && (
                <p className="mt-2 text-xs text-error-400">{errors.teamSize}</p>
              )}
            </div>

            {error && (
              <p className="rounded-xl border border-error-500/30 bg-error-500/10 px-4 py-3 text-sm text-error-300">
                {error}
              </p>
            )}

            <button type="submit" disabled={!canSubmit} className="btn-primary w-full text-base">
              <PhoneCall className="h-5 w-5" />
              {isBusy ? 'Starting live conversation…' : 'Start Live Conversation'}
            </button>
            <p className="text-center text-xs text-ink-500">
              Your microphone is requested only after this form is submitted.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  type = 'text',
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-200">
        <Icon className="h-4 w-4 text-brand-300" />
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white outline-none transition placeholder:text-ink-600 focus:border-brand-400"
      />
      {error && <p className="mt-2 text-xs text-error-400">{error}</p>}
    </div>
  );
}
