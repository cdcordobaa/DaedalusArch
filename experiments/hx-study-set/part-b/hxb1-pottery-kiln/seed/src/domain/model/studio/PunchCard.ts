/** A member's card of open-studio sessions. */
export interface PunchCard {
  readonly memberId: string;
  readonly sessionsLeft: number;
  readonly expires: string;
}
