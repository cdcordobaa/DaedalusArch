import { DomainEvent } from "../../shared-kernel/DomainEvent";

export interface ChargeSettled extends DomainEvent {
  readonly type: "ChargeSettled";
  readonly chargeId: string;
  readonly rentalId: string;
}
