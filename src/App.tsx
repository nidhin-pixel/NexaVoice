import { useState } from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import { PreCallForm } from '@/components/workspace/PreCallForm';
import { Workspace } from '@/components/workspace/Workspace';
import type { PreCallProspect } from '@/data/precall';

type View = 'landing' | 'precall' | 'workspace';

function App() {
  const [view, setView] = useState<View>('landing');
  const [preCall, setPreCall] = useState<PreCallProspect | null>(null);

  if (view === 'workspace') {
    return (
      <Workspace
        preCall={preCall}
        onExit={() => {
          setPreCall(null);
          setView('landing');
        }}
      />
    );
  }

  if (view === 'precall') {
    return (
      <PreCallForm
        onBack={() => setView('landing')}
        onStart={(details) => {
          setPreCall(details);
          setView('workspace');
        }}
      />
    );
  }

  return <LandingPage onStartConversation={() => setView('precall')} />;
}

export default App;

