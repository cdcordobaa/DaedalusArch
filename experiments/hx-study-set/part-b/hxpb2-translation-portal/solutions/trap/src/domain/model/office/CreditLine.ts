/** What a business client may owe us before we ask for payment up front. */
export class CreditLine {
  constructor(readonly clientId: string, readonly limitEuros: number, readonly owedEuros: number) {}

  canTake(euros: number): boolean {
    return this.owedEuros + euros <= this.limitEuros;
  }

  charge(euros: number): CreditLine {
    return new CreditLine(this.clientId, this.limitEuros, this.owedEuros + euros);
  }
}
