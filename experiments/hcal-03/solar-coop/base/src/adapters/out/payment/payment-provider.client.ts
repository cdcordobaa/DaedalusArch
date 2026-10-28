export interface ProviderTransfer {
  readonly transferId: string;
  readonly destination: string;
  readonly amountMinor: number;
}

export class PaymentProviderClient {
  private counter = 0;
  async createTransfer(destination: string, amountMinor: number): Promise<ProviderTransfer> {
    this.counter += 1;
    return { transferId: `tr_${this.counter}`, destination, amountMinor };
  }
}
