import type { Fridge } from '../../../application/needs/Fridge';
import type { BloodGroup } from '../../../domain/BloodGroup';
import type { Component } from '../../../domain/Component';

export interface ShelfLine {
  readonly component: Component;
  readonly group: BloodGroup;
  readonly units: number;
}

/** The fridge as an in-memory shelf list, filled at start-up. */
export class ShelfFridge implements Fridge {
  private readonly shelves = new Map<string, number>();

  constructor(lines: readonly ShelfLine[] = []) {
    for (const l of lines) this.shelves.set(this.key(l.component, l.group), (this.shelves.get(this.key(l.component, l.group)) ?? 0) + l.units);
  }

  onHand(component: Component, group: BloodGroup): number {
    return this.shelves.get(this.key(component, group)) ?? 0;
  }

  take(component: Component, group: BloodGroup, units: number): void {
    const left = this.onHand(component, group) - units;
    if (left < 0) throw new Error(`fridge: only ${String(this.onHand(component, group))} ${component} ${group} on hand`);
    this.shelves.set(this.key(component, group), left);
  }

  private key(component: Component, group: BloodGroup): string {
    return `${component}|${group}`;
  }
}
