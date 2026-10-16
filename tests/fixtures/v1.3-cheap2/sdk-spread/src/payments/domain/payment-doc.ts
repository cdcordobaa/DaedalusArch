import type { Document } from 'mongoose';

/** PLANTED P4: a type-only vendor import in the domain (score 0.5). */
export interface PaymentDoc extends Document {
  readonly cents: number;
}
