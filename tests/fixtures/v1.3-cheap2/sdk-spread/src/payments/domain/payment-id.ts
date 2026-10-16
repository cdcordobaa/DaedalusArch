import { randomUUID } from 'crypto';

/** NEAR-MISS N5: a node built-in in the domain is not a vendor SDK. */
export function newPaymentId(): string {
  return randomUUID();
}
