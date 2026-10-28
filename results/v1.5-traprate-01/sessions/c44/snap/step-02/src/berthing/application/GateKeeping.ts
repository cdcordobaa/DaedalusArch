import type { GateRegister } from './ports/GateRegister';

/** Keeps the dock gate list: every member's boat may come through. */
export class GateKeeping {
  constructor(private readonly gate: GateRegister) {}

  admit(boatName: string, ownerName: string): void {
    this.gate.allow(`${boatName} (${ownerName})`);
  }
}
