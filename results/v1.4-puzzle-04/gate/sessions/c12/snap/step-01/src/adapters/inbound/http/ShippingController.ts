import { FastshipUnavailableError } from 'fastship-sdk';
import type { QuoteShipment } from '../../../application/ports/in/QuoteShipment';
import type { TrackShipment } from '../../../application/ports/in/TrackShipment';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** GET /quotes?from=&to=&grams= and GET /tracking/:number. */
export class ShippingController {
  constructor(
    private readonly quotes: QuoteShipment,
    private readonly tracking: TrackShipment,
  ) {}

  async getQuote(query: Record<string, string | undefined>): Promise<HttpResponse> {
    try {
      const body = await this.quotes.quote({ from: query.from ?? '', to: query.to ?? '', weightGrams: Number(query.grams) });
      return { status: 200, body };
    } catch (e) {
      if (e instanceof FastshipUnavailableError) return { status: 503, body: { error: 'carrier rates are temporarily unavailable' } };
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async getTracking(trackingNumber: string): Promise<HttpResponse> {
    return { status: 200, body: await this.tracking.track(trackingNumber) };
  }
}
