import { useCallback, useEffect, useState } from 'react';
import { startSession, type Session } from './learning/session';
import { problemsToday } from './learning/streak';
import { msUntilReminder, showReminder } from './reminders/notify';
import { loadProgress, saveProgress, type Progress } from './storage/progress';
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
  | { name: 'stats' };

export default function App() {
  const [progress, setProgressState] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [learnSkill, setLearnSkill] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState(true);

  const setProgress = useCallback((p: Progress) => setProgressState(p), []);
  useEffect(() => setStorageOk(saveProgress(progress)), [progress]);

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
          setProgress={setProgress}
          onStart={(goal) => start(undefined, goal)}
          onPractice={(id) => start(id)}
          onLearn={setLearnSkill}
          onSettings={() => setScreen({ name: 'settings' })}
          onPlacement={() => setScreen({ name: 'placement' })}
          onTree={() => setScreen({ name: 'tree' })}
          onStats={() => setScreen({ name: 'stats' })}
        />
      )}
      {screen.name === 'session' && (
        <SessionScreen
          initial={screen.session}
          progress={progress}
          setProgress={setProgress}
          onFinish={(session) => setScreen({ name: 'summary', session })}
          onQuit={(session) => setScreen(session.answered > 0 ? { name: 'summary', session } : { name: 'home' })}
        />
      )}
      {screen.name === 'summary' && <Summary session={screen.session} progress={progress} onHome={home} />}
      {screen.name === 'settings' && (
        <Settings progress={progress} setProgress={setProgress} onPlacement={() => setScreen({ name: 'placement' })} onBack={home} />
      )}
      {screen.name === 'placement' && <Placement progress={progress} setProgress={setProgress} onDone={home} />}
      {screen.name === 'tree' && <SkillTree progress={progress} onPractice={(id) => start(id)} onLearn={setLearnSkill} onBack={home} />}
      {screen.name === 'stats' && <Stats progress={progress} onPractice={(id) => start(id)} onBack={home} />}
      {learnSkill && <LearnCard skillId={learnSkill} onClose={() => setLearnSkill(null)} />}
    </div>
  );
}
