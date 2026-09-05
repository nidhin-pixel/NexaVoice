import { useState } from 'react';
import { LandingPage } from '@/components/landing/LandingPage';
import { Workspace } from '@/components/workspace/Workspace';

type View = 'landing' | 'workspace';

function App() {
  const [view, setView] = useState<View>('landing');

  if (view === 'workspace') {
    return <Workspace onExit={() => setView('landing')} />;
  }

  return <LandingPage onStartConversation={() => setView('workspace')} />;
}

export default App;
