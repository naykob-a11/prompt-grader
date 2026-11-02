import { norm, vocab } from './vocabulary';

const MAX_LENGTH = 40;

const allHeadings = [...vocab.params, ...vocab.tints, ...vocab.bands].flatMap((x) =>
  x.aliases.map((alias) => ({ alias, normalized: norm(alias) })),
);

function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = row;
  }
  return previous[b.length]!;
}

/** The known heading closest to a misspelled one, or undefined if none is close. */
export function suggestHeading(heading: string): string | undefined {
  const typed = norm(heading);
  if (!typed || typed.length > MAX_LENGTH) return undefined;
  const limit = Math.max(2, Math.floor(typed.length / 3));
  let best: string | undefined;
  let bestDistance = limit + 1;
  for (const { alias, normalized } of allHeadings) {
    const d = distance(typed, normalized);
    if (d < bestDistance) {
      best = alias;
      bestDistance = d;
    }
  }
  return best;
}
