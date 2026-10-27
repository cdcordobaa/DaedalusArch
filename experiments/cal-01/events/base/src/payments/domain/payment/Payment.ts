export type PaymentStatus = "pending" | "captured" | "refunded";

export class Payment {
  private status: PaymentStatus = "pending";

  private constructor(
    readonly id: string,
    readonly ticketCode: string,
    private readonly amountCents: number,
  ) {}

  static create(id: string, ticketCode: string, amountCents: number): Payment {
    if (!(amountCents > 0)) throw new Error("amount must be positive");
    return new Payment(id, ticketCode, amountCents);
  }

  capture(): void {
    if (this.status !== "pending") throw new Error("payment is not pending");
    this.status = "captured";
  }

  refund(): void {
    if (this.status !== "captured") throw new Error("only captured payments can be refunded");
    this.status = "refunded";
  }

  getStatus(): PaymentStatus {
    return this.status;
  }

  getAmountCents(): number {
    return this.amountCents;
  }
}
