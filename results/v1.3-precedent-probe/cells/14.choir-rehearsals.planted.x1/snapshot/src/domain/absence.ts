import { involves, type Rehearsal } from './rehearsal';
import type { Singer } from './singer';

/** True when the singer was absent from both of the last two held rehearsals of their section (latest first). */
export function absentTwiceInARow(singer: Singer, rehearsalsUpToNow: readonly Rehearsal[]): boolean {
  const lastTwo = rehearsalsUpToNow
    .filter((r) => !r.cancelled && involves(r, singer.section))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 2);
  return lastTwo.length === 2 && lastTwo.every((r) => !r.attended.has(singer.id));
}
