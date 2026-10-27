import { bloodGroup, type BloodGroup } from './BloodGroup';
import { component, type Component } from './Component';
import { RequestRefused } from './RequestRefused';

export const MAX_UNITS_PER_REQUEST = 20;

/** A checked ward request: the checks run in this order and the first failing one refuses the request. */
export class UnitRequest {
  private constructor(
    readonly ward: string,
    readonly component: Component,
    readonly group: BloodGroup,
    readonly units: number,
    readonly urgent: boolean,
  ) {}

  static of(raw: { ward: string; component: string; group: string; units: number; urgent?: boolean }): UnitRequest {
    const ward = raw.ward.trim();
    if (ward === '') throw new RequestRefused('a request names the ward that needs the units');
    const c = component(raw.component);
    const g = bloodGroup(raw.group);
    if (!Number.isInteger(raw.units) || raw.units < 1 || raw.units > MAX_UNITS_PER_REQUEST) {
      throw new RequestRefused(`units must be a whole number from 1 to ${String(MAX_UNITS_PER_REQUEST)}`);
    }
    return new UnitRequest(ward, c, g, raw.units, raw.urgent === true);
  }
}
