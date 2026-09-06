-- Follow-up request fields reused by conversations and leads.
ALTER TABLE IF EXISTS public.conversations
  ADD COLUMN IF NOT EXISTS followup_request_type text,
  ADD COLUMN IF NOT EXISTS followup_date text,
  ADD COLUMN IF NOT EXISTS followup_time text,
  ADD COLUMN IF NOT EXISTS followup_timezone text,
  ADD COLUMN IF NOT EXISTS followup_confirmed boolean DEFAULT false;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS followup_request_type text,
  ADD COLUMN IF NOT EXISTS followup_date text,
  ADD COLUMN IF NOT EXISTS followup_time text,
  ADD COLUMN IF NOT EXISTS followup_timezone text,
  ADD COLUMN IF NOT EXISTS next_action text;
