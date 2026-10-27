import type { PhoneNumber } from '../../../domain/model/PhoneNumber';

/** The numbers whose patients asked not to be texted any more. */
export interface OptOuts {
  has(phone: PhoneNumber): Promise<boolean>;
  add(phone: PhoneNumber): Promise<void>;
}
