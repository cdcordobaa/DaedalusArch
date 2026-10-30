/** A day the office is shut; deadlines move past it. */
export interface ClosingDay {
  readonly date: string;
  readonly reason: string;
}
