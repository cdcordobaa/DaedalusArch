import type { BloodGroup } from '../../domain/BloodGroup';
import type { Component } from '../../domain/Component';

/** Our own blood fridge: units on hand by component and blood group. */
export interface Fridge {
  onHand(component: Component, group: BloodGroup): number;
  take(component: Component, group: BloodGroup, units: number): void;
}
