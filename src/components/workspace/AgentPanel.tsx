import { Phone, PhoneOff, Mic, MicOff, Radio } from 'lucide-react';
import type { AgentState, ConversationStatus } from '@/types/conversation';

interface AgentPanelProps {
  status: ConversationStatus;
  agentState: AgentState;
  isMuted: boolean;
  isSimMode: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onEscalate: () => void;
}

export function AgentPanel({
  status,
  agentState,
  isMuted,
  isSimMode,
  onStart,
  onEnd,
  onToggleMute,
  onEscalate,
}: AgentPanelProps) {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isIdle = status === 'idle' || status === 'ended';

  return (
    <div className="flex h-full flex-col items-center justify-between">
      {/* Header */}
      <div className="w-full border-b border-white/5 px-5 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">NexaVoice</h2>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Agent visualization */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <AgentOrb agentState={agentState} isConnected={isConnected} />

        <div className="mt-6 text-center">
          <div className="text-base font-semibold text-white">NexaVoice Agent</div>
          <div className="mt-1">
            <AgentStateLabel agentState={agentState} isConnected={isConnected} isMuted={isMuted} />
          </div>
        </div>

        {/* Voice activity bars */}
        <div className="mt-8 flex h-12 items-end justify-center gap-1">
          {isConnected && agentState !== 'idle' ? (
            Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="voice-bar w-1 rounded-full bg-gradient-to-t from-brand-600 to-brand-400"
                style={{
                  height: `${getBarHeight(agentState, i)}px`,
                  animationDelay: `${i * 60}ms`,
                  animationDuration: agentState === 'speaking' ? '0.8s' : '1.2s',
                }}
              />
            ))
          ) : (
            <div className="flex h-12 items-center text-sm text-ink-600">
              {isIdle ? 'Ready to connect' : 'Connecting...'}
            </div>
          )}
        </div>

        {isSimMode && isConnected && (
          <div className="mt-4 rounded-full bg-warning-500/10 px-3 py-1 text-xs text-warning-400">
            Demo Mode — Simulated Conversation
          </div>
        )}
      </div>

      {/* Call controls */}
      <div className="w-full border-t border-white/5 px-5 py-5">
        {isIdle ? (
          <button onClick={onStart} className="btn-primary w-full text-base">
            <Phone className="h-5 w-5" strokeWidth={2} />
            Start Conversation
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <ControlButton
              onClick={onToggleMute}
              active={!isMuted}
              disabled={!isConnected && !isConnecting}
              label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </ControlButton>

            <ControlButton
              onClick={onEscalate}
              active={true}
              disabled={!isConnected}
              label="Escalate"
              variant="warning"
            >
              <Radio className="h-5 w-5" />
            </ControlButton>

            <button
              onClick={onEnd}
              disabled={!isConnected && !isConnecting}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-error-500 text-white shadow-lg transition-all hover:bg-error-400 active:scale-95 disabled:opacity-40"
              title="End Conversation"
            >
              <PhoneOff className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentOrb({ agentState, isConnected }: { agentState: AgentState; isConnected: boolean }) {
  const isSpeaking = agentState === 'speaking';
  const isListening = agentState === 'listening';
  const isThinking = agentState === 'thinking';

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      {isConnected && isSpeaking && (
        <>
          <div className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/20" />
          <div
            className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/15"
            style={{ animationDelay: '0.6s' }}
          />
        </>
      )}
      {isConnected && isListening && (
        <div className="absolute inset-0 animate-pulse-ring rounded-full bg-accent-500/15" style={{ animationDuration: '3s' }} />
      )}

      <div
        className={`relative flex h-28 w-28 items-center justify-center rounded-full shadow-glow transition-all duration-500 ${
          isSpeaking
            ? 'bg-gradient-to-br from-brand-400 to-brand-600 scale-105'
            : isListening
              ? 'bg-gradient-to-br from-accent-400 to-accent-600'
              : isThinking
                ? 'bg-gradient-to-br from-warning-400 to-warning-600 animate-pulse'
                : 'bg-gradient-to-br from-ink-700 to-ink-800'
        }`}
      >
        <Phone
          className={`h-10 w-10 transition-colors ${
            isConnected ? 'text-white' : 'text-ink-500'
          }`}
          strokeWidth={1.75}
        />
      </div>
    </div>
  );
}

function AgentStateLabel({
  agentState,
  isConnected,
  isMuted,
}: {
  agentState: AgentState;
  isConnected: boolean;
  isMuted: boolean;
}) {
  if (!isConnected) return <span className="text-sm text-ink-500">Disconnected</span>;
  if (isMuted) return <span className="text-sm text-warning-400">Microphone muted</span>;

  const labels: Record<AgentState, { text: string; color: string }> = {
    idle: { text: 'Ready', color: 'text-ink-400' },
    listening: { text: 'Listening...', color: 'text-accent-400' },
    thinking: { text: 'Thinking...', color: 'text-warning-400' },
    speaking: { text: 'Speaking...', color: 'text-brand-300' },
  };

  const { text, color } = labels[agentState];
  const dotColor = color.replace('text-', 'bg-');
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <span className={`h-2 w-2 rounded-full ${dotColor} animate-pulse`} />
      {text}
    </span>
  );
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  const config: Record<ConversationStatus, { label: string; color: string; dot: string }> = {
    idle: { label: 'Idle', color: 'text-ink-400', dot: 'bg-ink-500' },
    connecting: { label: 'Connecting', color: 'text-warning-400', dot: 'bg-warning-500' },
    connected: { label: 'Connected', color: 'text-success-400', dot: 'bg-success-500' },
    ended: { label: 'Ended', color: 'text-ink-400', dot: 'bg-ink-500' },
    error: { label: 'Error', color: 'text-error-400', dot: 'bg-error-500' },
  };

  const c = config[status];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${c.color}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot} ${status === 'connecting' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

function ControlButton({
  onClick,
  active,
  disabled,
  label,
  children,
  variant = 'default',
}: {
  onClick: () => void;
  active: boolean;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
  variant?: 'default' | 'warning';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-12 w-12 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40 ${
        variant === 'warning'
          ? 'bg-warning-500/15 text-warning-400 hover:bg-warning-500/25'
          : active
            ? 'bg-white/10 text-white hover:bg-white/15'
            : 'bg-error-500/15 text-error-400 hover:bg-error-500/25'
      }`}
    >
      {children}
    </button>
  );
}

function getBarHeight(agentState: AgentState, index: number): number {
  if (agentState === 'speaking') {
    return 20 + Math.sin(index * 0.8) * 18 + Math.random() * 10;
  }
  if (agentState === 'listening') {
    return 8 + Math.sin(index * 0.5) * 6 + Math.random() * 4;
  }
  if (agentState === 'thinking') {
    return 4 + Math.random() * 8;
  }
  return 4;
}
