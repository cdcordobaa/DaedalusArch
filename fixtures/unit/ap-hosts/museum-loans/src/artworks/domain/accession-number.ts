/** Accession numbers are `<year>.<sequence>` (`2024.117`); objects on loan get an `L` prefix (`L2024.3`). */
export class AccessionNumber {
  readonly year: number;
  readonly sequence: number;
  readonly onLoan: boolean;

  private constructor(year: number, sequence: number, onLoan: boolean) {
    this.year = year;
    this.sequence = sequence;
    this.onLoan = onLoan;
  }

  static next(year: number, lastSequence: number, onLoan: boolean): AccessionNumber {
    return new AccessionNumber(year, lastSequence + 1, onLoan);
  }

  toString(): string {
    return `${this.onLoan ? 'L' : ''}${String(this.year)}.${String(this.sequence)}`;
  }
}
