import type { BloodGroup } from '../BloodGroup';
import type { Component } from '../Component';
import type { SupplyHold } from './SupplyHold';

/** The holds we have met, by component and blood group; a hold counts until its lift time has passed. */
export class SupplyHolds {
  private readonly holds = new Map<string, SupplyHold>();

  place(component: Component, group: BloodGroup, hold: SupplyHold): void {
    this.holds.set(`${component}|${group}`, hold);
  }

  activeFor(component: Component, group: BloodGroup, now: Date): SupplyHold | null {
    const hold = this.holds.get(`${component}|${group}`);
    return hold !== undefined && now.getTime() <= hold.until.getTime() ? hold : null;
  }
}
