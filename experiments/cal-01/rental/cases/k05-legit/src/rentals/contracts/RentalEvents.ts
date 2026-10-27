import { DomainEvent } from "../../shared-kernel/DomainEvent";

export interface RentalOpened extends DomainEvent {
  readonly type: "RentalOpened";
  readonly rentalId: string;
  readonly equipmentId: string;
  readonly customerId: string;
  readonly days: number;
}

export interface RentalReturned extends DomainEvent {
  readonly type: "RentalReturned";
  readonly rentalId: string;
  readonly equipmentId: string;
  readonly customerId: string;
  readonly amountCents: number;
  readonly currency: string;
}

export interface RentalExtended extends DomainEvent {
  readonly type: "RentalExtended";
  readonly rentalId: string;
  readonly equipmentId: string;
  readonly extraDays: number;
}
