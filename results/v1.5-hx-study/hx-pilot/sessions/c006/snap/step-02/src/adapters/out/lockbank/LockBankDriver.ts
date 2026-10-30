import type { LockBankHub } from './LockBankHub';

export interface LockBankPulse {
  /** The hub's id; each building's hub carries the building id. */
  readonly hub: string;
  readonly bay: number;
  /** How long the latch is held open, in milliseconds (LockBank asks for 500 to 2000). */
  readonly holdMs: number;
}

export interface LockBankAck {
  readonly result: 'OPENED' | 'JAMMED' | 'REJECTED';
  readonly hub: string;
  readonly bay: number;
}

/** Client for the LockBank hub API, authenticated with the site key. */
export class LockBankDriver {
  constructor(
    private readonly hardware: LockBankHub,
    private readonly siteKey: string,
  ) {}

  pulse(command: LockBankPulse): LockBankAck {
    if (this.siteKey === '' || command.holdMs < 500 || command.holdMs > 2000) return { result: 'REJECTED', hub: command.hub, bay: command.bay };
    const fired = this.hardware.fire(command.hub, command.bay);
    return { result: fired ? 'OPENED' : 'JAMMED', hub: command.hub, bay: command.bay };
  }
}
