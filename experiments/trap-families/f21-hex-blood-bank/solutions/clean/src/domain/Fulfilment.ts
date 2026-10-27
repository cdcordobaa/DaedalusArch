export type FulfilmentStatus = 'filled' | 'partly filled' | 'unfilled' | 'on hold';

/** How a request was met: from our fridge, from the supplier, by O negative cover, and what is still missing. */
export class Fulfilment {
  private constructor(
    readonly fromStock: number,
    readonly fromSupplier: number,
    readonly substituted: number,
    readonly outstanding: number,
    private readonly ownGroupHeld: boolean,
  ) {}

  static of(requested: number, given: { fromStock: number; fromSupplier: number; substituted: number; ownGroupHeld: boolean }): Fulfilment {
    const outstanding = requested - given.fromStock - given.fromSupplier - given.substituted;
    return new Fulfilment(given.fromStock, given.fromSupplier, given.substituted, outstanding, given.ownGroupHeld);
  }

  /** filled, then on hold (own group held), then unfilled (nothing given), then partly filled. */
  status(): FulfilmentStatus {
    if (this.outstanding === 0) return 'filled';
    if (this.ownGroupHeld) return 'on hold';
    if (this.fromStock + this.fromSupplier + this.substituted === 0) return 'unfilled';
    return 'partly filled';
  }
}
