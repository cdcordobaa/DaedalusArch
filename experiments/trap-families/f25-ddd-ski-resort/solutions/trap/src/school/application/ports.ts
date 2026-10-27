/** The school's own list of pass holders, so the desk knows a pupil's name without asking the pass office. */
export interface PupilCards {
  remember(passNo: string, holder: string): void;
  nameOf(passNo: string): string | undefined;
}

/** Takes and gives back credit on a pupil's pass. */
export interface Wallet {
  pay(passNo: string, euros: number, what: string): void;
  load(passNo: string, euros: number): void;
}
