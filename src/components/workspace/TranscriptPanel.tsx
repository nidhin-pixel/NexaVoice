import { useEffect, useRef } from 'react';
import { User, Bot, AlertCircle } from 'lucide-react';
import type { TranscriptEntry } from '@/types/conversation';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  isActive: boolean;
}

export function TranscriptPanel({ transcript, isActive }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">Live Transcript</h2>
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-error-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error-500" />
              LIVE
            </span>
          )}
        </div>
        <span className="text-xs text-ink-500">{transcript.length} messages</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {transcript.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <p className="text-sm text-ink-500">
              {isActive
                ? 'Waiting for conversation to begin...'
                : 'Transcript will appear here once the conversation starts.'}
            </p>
          </div>
        )}

        {transcript.map((entry) => (
          <TranscriptBubble key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isCustomer = entry.role === 'customer';
  const isAgent = entry.role === 'agent';
  const isSystem = entry.role === 'system';

  if (isSystem) {
    return (
      <div className="flex items-center justify-center py-2 animate-fade-in-fast">
        <span className="flex items-center gap-1.5 rounded-full bg-warning-500/10 px-3 py-1.5 text-xs text-warning-400">
          <AlertCircle className="h-3 w-3" />
          {entry.text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 animate-fade-in-fast ${isAgent ? 'flex-row' : 'flex-row-reverse'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isAgent
            ? 'bg-gradient-to-br from-brand-500 to-brand-700'
            : 'bg-white/10'
        }`}
      >
        {isAgent ? (
          <Bot className="h-4 w-4 text-white" />
        ) : (
          <User className="h-4 w-4 text-ink-300" />
        )}
      </div>
      <div className={`max-w-[80%] ${isAgent ? '' : 'text-right'}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-ink-400">
            {isAgent ? 'AI Sales Agent' : 'Customer'}
          </span>
          <span className="text-xs text-ink-600">
            {formatTime(entry.timestamp)}
          </span>
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isAgent
              ? 'bg-brand-500/10 text-brand-100 rounded-tl-sm'
              : 'bg-white/5 text-ink-200 rounded-tr-sm'
          }`}
        >
          {entry.text}
        </div>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
