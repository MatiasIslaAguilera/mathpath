// Rebuild Progress from the event log + profile. Deterministic: the same events give the same
// Progress on every device.

import { applyAttemptEvent, applyInterpretationEvent } from '../learning/record';
import { applyPlacementEvent } from '../learning/placement';
import { sortEvents, type LearningEvent, type Profile } from './events';
import { emptyProgress, type Progress } from './progress';

/** Apply one event in place. */
export function applyEvent(p: Progress, e: LearningEvent): void {
  switch (e.type) {
    case 'attempt':
      applyAttemptEvent(p, e);
      return;
    case 'interpretation':
      applyInterpretationEvent(p, e);
      return;
    case 'placement':
      applyPlacementEvent(p, e);
      return;
    case 'baseline': {
      // Replace learning state with the snapshot; profile fields are overlaid afterwards.
      const snap = structuredClone(e.progress);
      p.xp = snap.xp;
      p.skills = snap.skills;
      p.days = snap.days;
      p.mistakes = snap.mistakes;
      p.misconceptionCounts = snap.misconceptionCounts;
      p.stepMisses = snap.stepMisses;
      p.placement = snap.placement;
      if (snap.onboarding) p.onboarding = snap.onboarding;
      return;
    }
  }
}

export function overlayProfile(p: Progress, profile: Profile): Progress {
  p.settings = { ...p.settings, ...profile.settings };
  // A placement anywhere in the log means onboarding happened, whatever the profile says.
  p.onboarding = p.onboarding === 'placed' ? 'placed' : (profile.onboarding ?? p.onboarding);
  p.welcomeShownOn = profile.welcomeShownOn;
  return p;
}

export function rebuild(events: LearningEvent[], profile: Profile, start: Progress = emptyProgress()): Progress {
  const p = structuredClone(start);
  for (const e of sortEvents(events)) applyEvent(p, e);
  return overlayProfile(p, profile);
}
