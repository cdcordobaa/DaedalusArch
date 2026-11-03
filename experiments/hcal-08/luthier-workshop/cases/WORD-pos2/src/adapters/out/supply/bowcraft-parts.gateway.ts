import { BowcraftClient, BowcraftError } from 'bowcraft-sdk';
import { PartsOrder, PartsSupplierPort } from '../../../application/ports/out/parts-supplier.port';
import { SupplierUnavailableError } from '../../../domain/errors';
import { SupplyTicket } from '../../../domain/supply';

export class BowcraftPartsGateway implements PartsSupplierPort {
  private readonly client: BowcraftClient;

  constructor(apiKey: string) {
    this.client = new BowcraftClient({ api_key: apiKey });
  }

  async order(parts: PartsOrder): Promise<SupplyTicket> {
    try {
      const res = await this.client.order({ part_sku: parts.partSku, species: parts.timber, qty: parts.quantity, colour: '' });
      return {
        supplyRef: res.order_ref,
        availability: res.fulfilment === 'VOIDED' ? 'unavailable' : res.backorder ? 'backorder' : 'in-stock',
        arrivalDate: res.eta_date,
      };
    } catch (e) {
      if (e instanceof BowcraftError) throw new SupplierUnavailableError(`parts supplier unavailable: ${e.message}`);
      throw e;
    }
  }
}
