export interface IdGenerator { next(prefix: string): string }
export interface Clock { now(): Date }

/** Everything saved inside run() (changes and their audit entries) is kept together or not at all. */
export interface Transaction { run<T>(work: () => T): T }

export interface TillWaveSale { saleId: string; merchantId: string; amountCents: number; time: string }

/** TillWave's HTTP API, polled for new sales. */
export interface TillWaveApi {
  salesSince(cursor: string | undefined): Promise<{ sales: TillWaveSale[]; cursor: string }>;
}
