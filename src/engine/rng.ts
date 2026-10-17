// Seeded RNG (mulberry32). Every problem is reproducible from (skillId, level, seed).

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  /** Uniform integer in [lo, hi] excluding 0. */
  nonzero(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** true with probability p. */
  chance(p: number): boolean;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    nonzero(lo, hi) {
      if (lo === 0 && hi === 0) throw new Error('nonzero: empty range');
      for (;;) {
        const v = int(lo, hi);
        if (v !== 0) return v;
      }
    },
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
