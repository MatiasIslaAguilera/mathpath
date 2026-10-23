import { useEffect, useRef, useState } from 'react';
import { startSession, type Session } from './learning/session';
import { problemsToday } from './learning/streak';
import { msUntilReminder, showReminder } from './reminders/notify';
import { useLearningStore } from './storage/useLearningStore';
import { ConfirmDialog } from './ui/components/ConfirmDialog';
import { Challenge } from './ui/screens/Challenge';
import { Home } from './ui/screens/Home';
import { LearnCard } from './ui/screens/LearnCard';
import { Placement } from './ui/screens/Placement';
import { SessionScreen } from './ui/screens/SessionScreen';
import { Settings } from './ui/screens/Settings';
import { SkillTree } from './ui/screens/SkillTree';
import { Stats } from './ui/screens/Stats';
import { Summary } from './ui/screens/Summary';

type Screen =
  | { name: 'home' }
  | { name: 'session'; session: Session }
  | { name: 'summary'; session: Session }
  | { name: 'settings' }
  | { name: 'placement' }
  | { name: 'tree' }
  | { name: 'stats' }
  | { name: 'challenge' };

export default function App() {
  const { progress, events, status, storageOk, actions } = useLearningStore();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [learnSkill, setLearnSkill] = useState<string | null>(null);

  // Best-effort in-app reminder; recomputed whenever progress or settings change.
  const { inAppReminder, reminderTime } = progress.settings;
  const practicedToday = problemsToday(progress.days) >= 1;
  useEffect(() => {
    if (!inAppReminder || !reminderTime) return;
    const ms = msUntilReminder(reminderTime, practicedToday);
    if (ms === null) return;
    const t = setTimeout(() => void showReminder(), ms);
    return () => clearTimeout(t);
  }, [inAppReminder, reminderTime, practicedToday]);

  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  const start = (only?: string, goalOverride?: number) => {
    // A practice run on one skill is a short focused set; the daily session uses the goal.
    // goalOverride is for the welcome-back "Do 3 problems" restart.
    const goal = goalOverride ?? (only ? 5 : progress.settings.dailyGoal);
    setScreen({ name: 'session', session: startSession(progress, goal, { only }) });
  };
  const home = () => setScreen({ name: 'home' });

  // Android back gesture / browser back. Every screen above Home is guarded by ONE history entry:
  // a back press consumes it and goes back one layer (Learn card, then the screen; a session or
  // placement asks first), and the entry is pushed again while we are still above Home. Back on
  // Home leaves the app, as Android users expect.
  const atRoot = screen.name === 'home' && !learnSkill;
  const [backPress, setBackPress] = useState(0);
  const [leavePlacement, setLeavePlacement] = useState(false);
  const [placementBusy, setPlacementBusy] = useState(false);
  const [guardTick, setGuardTick] = useState(0);
  const nav = useRef({ guard: false, skip: 0 });
  const onBack = useRef(() => {});
  onBack.current = () => {
    if (learnSkill) setLearnSkill(null);
    else if (screen.name === 'session') setBackPress((n) => n + 1);
    else if (screen.name === 'placement' && placementBusy) setLeavePlacement((open) => !open);
    else home();
  };
  useEffect(() => {
    const n = nav.current;
    if (!atRoot && !n.guard) {
      history.pushState({ mathpath: 'guard' }, '');
      n.guard = true;
    } else if (atRoot && n.guard) {
      // Left by an in-app button: drop the unused entry so the next back exits the app.
      n.guard = false;
      n.skip++;
      history.back();
    }
  }, [atRoot, guardTick]);
  useEffect(() => {
    const onPop = () => {
      const n = nav.current;
      if (n.skip > 0) {
        n.skip--;
        return;
      }
      n.guard = false;
      onBack.current();
      setGuardTick((t) => t + 1); // re-guard if this back press kept us above Home
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const leaveScreen = (to: Screen) => {
    setLeavePlacement(false);
    setPlacementBusy(false);
    setScreen(to);
  };

  return (
    <div className="app">
      {!online && (
        <div className="offline-banner" role="status" data-testid="offline-banner">
          You're offline. Everything still works.
        </div>
      )}
      {!storageOk && <div className="storage-warning">This browser isn't saving progress. Export a backup in Settings before closing.</div>}
      {screen.name === 'home' && (
        <Home
          progress={progress}
          events={events}
          syncStatus={status}
          updateProfile={actions.updateProfile}
          onStart={(goal) => start(undefined, goal)}
          onPractice={(id) => start(id)}
          onLearn={setLearnSkill}
          onSettings={() => setScreen({ name: 'settings' })}
          onPlacement={() => setScreen({ name: 'placement' })}
          onTree={() => setScreen({ name: 'tree' })}
          onStats={() => setScreen({ name: 'stats' })}
          onChallenge={() => setScreen({ name: 'challenge' })}
        />
      )}
      {screen.name === 'session' && (
        <SessionScreen
          initial={screen.session}
          progress={progress}
          record={actions.record}
          onFinish={(session) => setScreen({ name: 'summary', session })}
          onQuit={(session) => setScreen(session.answered > 0 ? { name: 'summary', session } : { name: 'home' })}
          backPress={backPress}
        />
      )}
      {screen.name === 'summary' && <Summary session={screen.session} progress={progress} onHome={home} />}
      {screen.name === 'settings' && (
        <Settings
          progress={progress}
          syncStatus={status}
          onSyncNow={actions.syncNow}
          updateProfile={actions.updateProfile}
          importText={actions.importText}
          exportJson={actions.exportJson}
          onPlacement={() => setScreen({ name: 'placement' })}
          onBack={home}
        />
      )}
      {screen.name === 'placement' && <Placement progress={progress} record={actions.record} onDone={() => leaveScreen({ name: 'home' })} onInProgress={setPlacementBusy} />}
      {screen.name === 'placement' && leavePlacement && (
        <ConfirmDialog
          title="Leave the placement test?"
          body="Your answers so far won't be saved. You can take it again from Settings."
          stay="Keep going"
          leave="Leave"
          onStay={() => setLeavePlacement(false)}
          onLeave={() => leaveScreen({ name: 'home' })}
        />
      )}
      {screen.name === 'tree' && <SkillTree progress={progress} onPractice={(id) => start(id)} onLearn={setLearnSkill} onBack={home} />}
      {screen.name === 'stats' && <Stats progress={progress} onPractice={(id) => start(id)} onBack={home} />}
      {screen.name === 'challenge' && <Challenge onBack={home} />}
      {learnSkill && <LearnCard skillId={learnSkill} onClose={() => setLearnSkill(null)} />}
    </div>
  );
}
