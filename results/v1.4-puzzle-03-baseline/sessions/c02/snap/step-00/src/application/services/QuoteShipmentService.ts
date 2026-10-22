import { Parcel } from '../../domain/model/Parcel';
import { PriceTable } from '../../domain/services/PriceTable';
import type { QuoteRequest, QuoteShipment, QuoteView } from '../ports/in/QuoteShipment';

export class QuoteShipmentService implements QuoteShipment {
  constructor(private readonly table: PriceTable = new PriceTable()) {}

  async quote(request: QuoteRequest): Promise<QuoteView> {
    const parcel = Parcel.of(request.from, request.to, request.weightGrams);
    const quote = this.table.quote(parcel);
    return { amount: quote.price.amount(), currency: quote.price.currency, service: quote.service };
  }
}
