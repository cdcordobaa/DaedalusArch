import { DomainEvent } from "../../shared-kernel/DomainEvent";

export interface ChargeSettled extends DomainEvent {
  readonly type: "ChargeSettled";
  readonly chargeId: string;
  readonly rentalId: string;
}

export interface EarlySettlementRequested extends DomainEvent {
  readonly type: "EarlySettlementRequested";
  readonly rentalId: string;
}
