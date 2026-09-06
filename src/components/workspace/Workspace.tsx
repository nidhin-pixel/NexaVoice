import { ArrowLeft, PhoneCall } from 'lucide-react';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { TranscriptPanel } from '@/components/workspace/TranscriptPanel';
import { AgentPanel } from '@/components/workspace/AgentPanel';
import { ProspectPanel } from '@/components/workspace/ProspectPanel';
import { PostCallSummary } from '@/components/workspace/PostCallSummary';
import type { PreCallProspect } from '@/data/precall';

interface WorkspaceProps {
  preCall?: PreCallProspect | null;
  onExit: () => void;
}

export function Workspace({ preCall, onExit }: WorkspaceProps) {
  const conv = (useVoiceConversation as unknown as (initial?: PreCallProspect | null) => ReturnType<typeof useVoiceConversation>)(preCall);


  // Show post-call summary when conversation has ended and we have a summary
  if (conv.status === 'ended' && conv.summary) {
    return <PostCallSummary summary={conv.summary} onNewConversation={onExit} />;
  }

  const isActive = conv.status === 'connected' || conv.status === 'connecting';

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-white/5 hover:text-white"
            title="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <PhoneCall className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-sm font-bold text-white">NexaVoice</div>
              <div className="text-xs text-ink-500">Live Sales Workspace</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {conv.isSimMode && (
            <span className="chip bg-warning-500/10 text-warning-400">Demo Mode</span>
          )}
          {conv.error && (
            <span className="chip bg-error-500/10 text-error-400">{conv.error}</span>
          )}
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="grid h-[calc(100vh-57px)] grid-cols-1 gap-px bg-white/5 lg:grid-cols-[1fr_1.2fr_1fr]">
        {/* LEFT: Transcript */}
        <div className="card overflow-hidden rounded-none lg:rounded-2xl lg:m-2">
          <TranscriptPanel transcript={conv.transcript} isActive={isActive} />
        </div>

        {/* CENTER: Agent */}
        <div className="card overflow-hidden rounded-none lg:rounded-2xl lg:m-2 lg:my-2">
          <AgentPanel
            status={conv.status}
            agentState={conv.agentState}
            isMuted={conv.isMuted}
            isSimMode={conv.isSimMode}
            onStart={conv.start}
            onEnd={conv.end}
            onToggleMute={conv.toggleMute}
            onEscalate={conv.escalate}
          />
        </div>

        {/* RIGHT: Prospect Intelligence */}
        <div className="card overflow-hidden rounded-none lg:rounded-2xl lg:m-2">
          <ProspectPanel prospect={conv.prospect} isConnected={isActive} />
        </div>
      </div>
    </div>
  );
}
