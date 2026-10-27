import type { BloodGroup } from './BloodGroup';
import type { UnitRequest } from './UnitRequest';

/** O negative red cells can be given to any patient. */
export const UNIVERSAL_RED_CELLS: BloodGroup = 'O-';

/** Only urgent red cell requests of another group are covered with O negative. */
export function takesONegativeCover(request: UnitRequest): boolean {
  return request.urgent && request.component === 'red cells' && request.group !== UNIVERSAL_RED_CELLS;
}
