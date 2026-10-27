import { FakePaymentGateway } from "../../infrastructure/FakePaymentGateway";
import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";
import { ChargeSettled } from "../../contracts/BillingEvents";

export type ChargeStatus = "pending" | "settled" | "refunded";

export class Charge {
  private _status: ChargeStatus = "pending";
  private _receiptRef: string | undefined;
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly rentalId: string,
    readonly amount: Money,
  ) {}

  static create(id: string, rentalId: string, amount: Money): Charge {
    return new Charge(id, rentalId, amount);
  }

  get status(): ChargeStatus {
    return this._status;
  }

  get receiptRef(): string | undefined {
    return this._receiptRef;
  }

  settle(receiptRef: string): void {
    if (this._status !== "pending") throw new Error("charge is not pending");
    if (receiptRef.trim() === "") throw new Error("receipt reference required");
    this._status = "settled";
    this._receiptRef = receiptRef;
    const event: ChargeSettled = { type: "ChargeSettled", occurredAt: new Date(), chargeId: this.id, rentalId: this.rentalId };
    this.events.push(event);
  }

  refund(): void {
    if (this._status !== "settled") throw new Error("only settled charges can be refunded");
    this._status = "refunded";
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }

  async collect(gateway: FakePaymentGateway): Promise<void> {
    this.settle(await gateway.capture(this.id, this.amount));
  }
}
