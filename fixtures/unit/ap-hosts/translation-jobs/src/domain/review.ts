/** Quality review of a delivery (LISA-style score 1–5); below three the job goes back to the translator. */
export class Review {
  static readonly PASS_SCORE = 3;

  readonly score: number;

  constructor(
    readonly id: string,
    readonly jobId: string,
    readonly reviewerId: string,
    score: number,
    readonly comments: string,
  ) {
    this.score = score;
  }

  passes(): boolean {
    return this.score >= Review.PASS_SCORE;
  }
}
