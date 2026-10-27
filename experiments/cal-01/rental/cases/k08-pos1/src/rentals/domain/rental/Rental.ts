import { DomainEvent } from "../../../shared-kernel/DomainEvent";
import { Money } from "../../../shared-kernel/Money";
import { RentalOpened, RentalReturned } from "../../contracts/RentalEvents";

export type RentalStatus = "open" | "returned";

export class Extension {
  constructor(
    readonly days: number,
    readonly addedAt: Date,
  ) {}
}

export class Rental {
  static readonly MAX_DAYS = 30;

  private readonly _extensions: Extension[] = [];
  private _status: RentalStatus = "open";
  private readonly events: DomainEvent[] = [];

  private constructor(
    readonly id: string,
    readonly equipmentId: string,
    readonly customerId: string,
    private readonly _baseDays: number,
    readonly dailyRate: Money,
  ) {}

  static open(id: string, equipmentId: string, customerId: string, days: number, dailyRate: Money): Rental {
    if (!Number.isInteger(days) || days < 1) throw new Error("rental must last 1 to 30 days");
    const rental = new Rental(id, equipmentId, customerId, days, dailyRate);
    const event: RentalOpened = { type: "RentalOpened", occurredAt: new Date(), rentalId: id, equipmentId, customerId, days };
    rental.events.push(event);
    return rental;
  }

  get status(): RentalStatus {
    return this._status;
  }

  get extensions(): readonly Extension[] {
    return this._extensions;
  }

  get totalDays(): number {
    return this._extensions.reduce((sum, e) => sum + e.days, this._baseDays);
  }

  extend(extraDays: number): void {
    if (this._status !== "open") throw new Error("rental is closed");
    if (!Number.isInteger(extraDays) || extraDays < 1) throw new Error("extension must be a positive number of days");
    if (this.totalDays + extraDays > Rental.MAX_DAYS) throw new Error("rental cannot exceed 30 days");
    this._extensions.push(new Extension(extraDays, new Date()));
  }

  giveBack(): void {
    if (this._status !== "open") throw new Error("rental already closed");
    this._status = "returned";
    const amount = this.dailyRate.times(this.totalDays);
    const event: RentalReturned = {
      type: "RentalReturned",
      occurredAt: new Date(),
      rentalId: this.id,
      equipmentId: this.equipmentId,
      customerId: this.customerId,
      amountCents: amount.cents,
      currency: amount.currency,
    };
    this.events.push(event);
  }

  pullEvents(): DomainEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
