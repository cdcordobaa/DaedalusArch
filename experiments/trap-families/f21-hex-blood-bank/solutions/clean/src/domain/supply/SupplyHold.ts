/** Why the region holds a component and group back. */
export type HoldReason = 'shortage' | 'quarantine';

export interface SupplyHold {
  readonly reason: HoldReason;
  readonly until: Date;
}

/** The supplier will not supply this component and group until the hold lifts. */
export class SupplyHeld extends Error {
  constructor(readonly hold: SupplyHold) {
    super(`supply on hold (${hold.reason}) until ${hold.until.toISOString()}`);
    this.name = 'SupplyHeld';
  }
}

/** The supplier could not take or answer the order. */
export class SupplierFailed extends Error {
  constructor(reason: string) {
    super(`regional supplier failed: ${reason}`);
    this.name = 'SupplierFailed';
  }
}
