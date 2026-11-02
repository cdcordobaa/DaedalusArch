/** Moments are written YYYY-MM-DDTHH:MM (building local time). */
export function minutesOf(moment: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(moment);
  if (m === null) throw new Error(`not a moment: ${moment}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) / 60000;
}

export const hoursBetween = (from: string, to: string): number => (minutesOf(to) - minutesOf(from)) / 60;
