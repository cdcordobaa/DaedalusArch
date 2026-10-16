/** Boarding state of one pupil on one day, driven by card taps. */
export interface Attendance {
  pupilId: string;
  date: string; // YYYY-MM-DD
  onBus: boolean;
  /** True once the pupil has tapped on at least once that day. */
  hasBoarded: boolean;
}

export type TapKind = "board" | "leave";

/** Taps alternate: the first tap of the day boards, the next leaves, and so on. */
export function applyTap(current: Attendance | undefined, pupilId: string, date: string): { attendance: Attendance; kind: TapKind } {
  const onBus = current?.onBus ?? false;
  const kind: TapKind = onBus ? "leave" : "board";
  return {
    kind,
    attendance: { pupilId, date, onBus: !onBus, hasBoarded: (current?.hasBoarded ?? false) || kind === "board" },
  };
}
