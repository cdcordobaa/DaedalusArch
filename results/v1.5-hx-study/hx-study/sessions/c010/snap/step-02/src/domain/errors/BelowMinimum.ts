import { BakeryError } from './BakeryError';

/** The order is worth less than the depot's minimum order value. */
export class BelowMinimum extends BakeryError {
  /** missing: euros the order still lacks, or null when unknown. */
  constructor(readonly missing: number | null) {
    super('Below minimum order value');
    this.name = 'BelowMinimum';
  }
}
