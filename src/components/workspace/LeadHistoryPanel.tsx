import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface LeadRecord {
  id: string;
  contact_name: string | null;
  company: string | null;
  lead_status: string | null;
  recommended_plan: string | null;
  created_at: string;
}

export function LeadHistoryPanel() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadLeads() {
      const { data, error: queryError } = await supabase
        .from('leads')
        .select('id, contact_name, company, lead_status, recommended_plan, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (queryError) {
        if (active) setError(queryError.message);
        return;
      }
      if (active) setLeads((data ?? []) as LeadRecord[]);
    }
    void loadLeads();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Users className="h-4 w-4 text-brand-400" />
          Lead History
        </h2>
        <span className="text-xs text-ink-500">{leads.length} leads</span>
      </div>
      {error ? (
        <div className="rounded-lg border border-error-500/20 bg-error-500/5 p-3">
          <p className="text-sm text-error-400">{error}</p>
          {(error.includes('schema cache') || error.includes('does not exist') || error.includes('relation') || error.includes('table')) && (
            <p className="mt-1 text-xs text-ink-500">
              The leads table may not exist yet. Run the Supabase database migrations to set it up.
            </p>
          )}
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-ink-500">No leads created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink-500">
              <tr>
                <th className="pb-2 font-medium">Contact</th>
                <th className="pb-2 font-medium">Company</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-ink-300">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="py-2">{lead.contact_name ?? '—'}</td>
                  <td className="py-2">{lead.company ?? '—'}</td>
                  <td className="py-2 capitalize">{lead.lead_status ?? 'new'}</td>
                  <td className="py-2 capitalize">{lead.recommended_plan ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
