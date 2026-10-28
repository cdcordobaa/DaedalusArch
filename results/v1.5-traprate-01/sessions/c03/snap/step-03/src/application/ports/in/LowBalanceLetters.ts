export interface LowBalanceLetters {
  /** Writes a letter for every pupil whose balance is below the limit; returns how many were written. */
  send(): number;
}
