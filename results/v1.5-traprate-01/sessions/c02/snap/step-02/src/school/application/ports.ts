/** How the school takes lesson money from a pupil's pass. Answers at once. */
export interface Payments {
  /** Takes `euros` if the credit covers it and says so; otherwise takes nothing and returns false. */
  charge(passNo: string, euros: number, what: string): boolean;
  refund(passNo: string, euros: number, what: string): void;
}

/** The school's own list of pass holders, so the desk knows a pupil's name without asking the pass office. */
export interface PupilCards {
  remember(passNo: string, holder: string): void;
  nameOf(passNo: string): string | undefined;
}
