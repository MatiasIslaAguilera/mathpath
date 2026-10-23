// Pareto, the garden cat. Its pose is today's progress (learning/garden.ts `catMood`):
// asleep before the first problem, curious once started, content when the day counts, happy at
// the goal. It is never sad: a missed day just means it's napping.

import type { Mood } from '../../learning/garden';

function Face({ mood }: { mood: Mood }) {
  const eyes =
    mood === 'curious' ? (
      <>
        <circle cx={42} cy={43} r={3.4} className="cat-ink" />
        <circle cx={58} cy={43} r={3.4} className="cat-ink" />
        <circle cx={43.2} cy={41.8} r={1.1} className="cat-white" />
        <circle cx={59.2} cy={41.8} r={1.1} className="cat-white" />
      </>
    ) : (
      <>
        <path d="M38 44 Q42 39.5 46 44" className="cat-line" />
        <path d="M54 44 Q58 39.5 62 44" className="cat-line" />
      </>
    );
  return (
    <>
      {eyes}
      {(mood === 'happy' || mood === 'content') && (
        <>
          <ellipse cx={36.5} cy={50} rx={3.6} ry={2.1} className="cat-blush" />
          <ellipse cx={63.5} cy={50} rx={3.6} ry={2.1} className="cat-blush" />
        </>
      )}
      <path d="M48 48.5 H52 L50 51 Z" className="cat-nose" />
      <path d="M50 51 Q48 53.6 45.8 52 M50 51 Q52 53.6 54.2 52" className="cat-line thin" />
      <path d="M30 48 L21 46 M30 51 L21 52 M70 48 L79 46 M70 51 L79 52" className="cat-whisker" />
    </>
  );
}

function Ears() {
  return (
    <>
      <path d="M30.5 34 L33 13 L47 25 Z" className="cat-fur" />
      <path d="M69.5 34 L67 13 L53 25 Z" className="cat-fur" />
      <path d="M34 28 L35 18.5 L42 24.5 Z" className="cat-inner" />
      <path d="M66 28 L65 18.5 L58 24.5 Z" className="cat-inner" />
    </>
  );
}

export function Cat({ mood }: { mood: Mood }) {
  if (mood === 'sleeping') {
    return (
      <svg className="cat sleeping" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse cx={52} cy={95} rx={36} ry={4} className="cat-shadow" />
        <ellipse cx={56} cy={78} rx={32} ry={16} className="cat-fur" />
        <path d="M60 64 Q62 70 60 75 M70 65 Q72 71 70 76 M50 65 Q52 70 50 75" className="cat-stripe" />
        <path d="M86 82 Q92 96 66 94 Q48 93 40 90" className="cat-tail" />
        <g transform="translate(-14 31) scale(0.82)">
          <Ears />
          <ellipse cx={50} cy={43} rx={22} ry={18.5} className="cat-fur" />
          <path d="M50 25.5 V31 M44.5 26.5 L45.5 31 M55.5 26.5 L54.5 31" className="cat-stripe" />
          <path d="M38 43 Q42 46.5 46 43" className="cat-line" />
          <path d="M54 43 Q58 46.5 62 43" className="cat-line" />
          <path d="M48 48.5 H52 L50 51 Z" className="cat-nose" />
        </g>
        <g className="cat-zzz">
          <text x={50} y={46} className="cat-z">z</text>
          <text x={60} y={34} className="cat-z big">z</text>
        </g>
      </svg>
    );
  }
  return (
    <svg className={`cat ${mood}`} viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx={50} cy={95} rx={30} ry={4} className="cat-shadow" />
      <path className="cat-tail swish" d={mood === 'curious' ? 'M70 86 Q92 80 86 58 Q84 50 90 46' : 'M70 88 Q96 92 86 72'} />
      <ellipse cx={50} cy={73} rx={23} ry={21} className="cat-fur" />
      <ellipse cx={50} cy={78} rx={12.5} ry={14} className="cat-belly" />
      <path d="M30 66 Q34 68 35 72 M70 66 Q66 68 65 72" className="cat-stripe" />
      <ellipse cx={42} cy={92} rx={6.5} ry={3.6} className="cat-belly" />
      <ellipse cx={58} cy={92} rx={6.5} ry={3.6} className="cat-belly" />
      <Ears />
      <ellipse cx={50} cy={43} rx={22} ry={19} className="cat-fur" />
      <path d="M50 25 V31 M44.5 26 L45.5 31 M55.5 26 L54.5 31" className="cat-stripe" />
      <Face mood={mood} />
      {mood === 'happy' && <path className="cat-heart" d="M80 22 C80 18 85 17 86 21 C87 17 92 18 92 22 C92 26 86 30 86 30 C86 30 80 26 80 22 Z" />}
    </svg>
  );
}
