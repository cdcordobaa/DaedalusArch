export interface IdGenerator { next(prefix: string): string }
export interface Clock { now(): Date }

export interface TillWaveSale { saleId: string; merchantId: string; amountCents: number; time: string }

/** TillWave's HTTP API, polled for new sales. */
export interface TillWaveApi {
  salesSince(cursor: string | undefined): Promise<{ sales: TillWaveSale[]; cursor: string }>;
}
