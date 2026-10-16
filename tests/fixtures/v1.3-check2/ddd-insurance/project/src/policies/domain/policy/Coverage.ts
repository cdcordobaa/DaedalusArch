export class Coverage {
  peril: string;
  limitCents: number;
  deductibleCents: number;

  constructor(peril: string, limitCents: number, deductibleCents: number) {
    this.peril = peril;
    this.limitCents = limitCents;
    this.deductibleCents = deductibleCents;
  }
}
