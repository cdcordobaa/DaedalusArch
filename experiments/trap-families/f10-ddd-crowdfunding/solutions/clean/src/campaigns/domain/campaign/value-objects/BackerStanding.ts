/** The standing the backers side gives a backer, as campaigns read it. Campaigns never work it out themselves. */
export type BackerStanding = 'trusted' | 'established' | 'newcomer' | 'blocked';

const KNOWN: readonly BackerStanding[] = ['trusted', 'established', 'newcomer', 'blocked'];

export function parseStanding(value: string): BackerStanding {
  const found = KNOWN.find((s) => s === value);
  if (found === undefined) throw new Error(`unknown backer standing ${value}`);
  return found;
}
