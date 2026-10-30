const DAY_MS = 86_400_000;

/** The nights a hire occupies are [from, from + nights); it ends on the morning of the day after its last night. */
export class HireNights {
  static overlap(a: { from: string; nights: number }, b: { from: string; nights: number }): boolean {
    const aStart = Date.parse(a.from) / DAY_MS;
    const bStart = Date.parse(b.from) / DAY_MS;
    return aStart < bStart + b.nights && bStart < aStart + a.nights;
  }
}
