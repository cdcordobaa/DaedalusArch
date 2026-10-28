export type FulfilmentStatus = 'filled' | 'partly filled' | 'unfilled' | 'on hold';

/** How a request was met: units given from our own fridge and from the supplier, and units still missing. */
export class Fulfilment {
  private constructor(
    readonly fromStock: number,
    readonly fromSupplier: number,
    readonly outstanding: number,
    readonly substituted: number,
  ) {}

  static of(requested: number, fromStock: number, fromSupplier = 0, substituted = 0): Fulfilment {
    return new Fulfilment(fromStock, fromSupplier, requested - fromStock - fromSupplier - substituted, substituted);
  }

  status(): FulfilmentStatus {
    if (this.outstanding === 0) return 'filled';
    if (this.fromStock === 0 && this.fromSupplier === 0 && this.substituted === 0) return 'unfilled';
    return 'partly filled';
  }
}
