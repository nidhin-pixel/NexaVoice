export function mapConversationError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const text = raw.toLowerCase();

  if (/permission|notallowed|denied|could not start audio source|notreadableerror/.test(text)) {
    return 'Microphone access is required for a live conversation. Please allow microphone permission and try again.';
  }

  if (/notfounderror|requested device not found/.test(text)) {
    return 'No microphone was found. Connect a microphone and try again.';
  }

  if (/agora is not configured|hascredentials|app id/.test(text)) {
    return 'Live voice is not configured for this environment. Add the public Agora and Supabase values, then restart.';
  }

  if (/token/.test(text)) {
    return 'We could not start the voice session. Please try again in a moment.';
  }

  if (/agent start|unable to start agora/.test(text)) {
    return 'Emily could not join the conversation. Please end the attempt and try again.';
  }

  if (/network|failed to fetch|load failed/.test(text)) {
    return 'A network problem interrupted the session. Check your connection and try again.';
  }

  if (raw.trim()) {
    return raw.length > 180 ? 'Something went wrong while starting the conversation. Please try again.' : raw;
  }

  return 'Something went wrong while starting the conversation. Please try again.';
}

export function mapPersistError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'Unable to save this conversation.';
  if (/failed to fetch|network/.test(raw.toLowerCase())) {
    return 'The conversation ended, but we could not save it because the database is unreachable.';
  }
  return raw;
}

export function mapEmailError(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'The follow-up email could not be sent.';
  return raw;
}
