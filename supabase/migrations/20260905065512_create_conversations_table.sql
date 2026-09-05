/*
# Create conversations table for NexaVoice

1. Purpose
   Stores completed NexaVoice sales conversation records — prospect intelligence,
   lead qualification results, recommended plans, and conversation summaries.
   This is a single-tenant demo app (no sign-in screen), so all data is publicly
   accessible via the anon key.

2. New Tables
   - `conversations`
     - `id` (uuid, primary key)
     - `channel_name` (text, unique identifier for the Agora channel)
     - `started_at` (timestamptz, when the conversation began)
     - `ended_at` (timestamptz, when the conversation ended)
     - `duration_seconds` (integer, call duration)
     - `transcript` (jsonb, full conversation transcript)
     - `prospect` (jsonb, prospect intelligence data)
     - `summary_text` (text, human-readable conversation summary)
     - `customer_requirements` (text[], array of identified requirements)
     - `recommended_plan` (text, recommended plan id: starter/business/enterprise)
     - `lead_status` (text, qualification status)
     - `interest_level` (text, prospect interest level)
     - `estimated_deal_value` (integer, monthly deal value in INR)
     - `next_action` (text, recommended next sales action)
     - `escalation_status` (text, human escalation status)
     - `created_at` (timestamptz, record creation timestamp)

3. Security
   - Enable RLS on `conversations`.
   - Allow anon + authenticated CRUD (single-tenant demo, no sign-in).
   - All data is intentionally public/shared for the demo.
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  transcript jsonb DEFAULT '[]'::jsonb,
  prospect jsonb DEFAULT '{}'::jsonb,
  summary_text text,
  customer_requirements text[] DEFAULT '{}',
  recommended_plan text,
  lead_status text DEFAULT 'new',
  interest_level text DEFAULT 'unknown',
  estimated_deal_value integer,
  next_action text,
  escalation_status text DEFAULT 'none',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_lead_status ON conversations (lead_status);
