import sdk = require('ingotline-sdk');
import { AlloyOrder, AlloySupplierPort } from '../../../application/ports/out/alloy-supplier.port';
import { SupplierUnavailableError } from '../../../domain/errors';
import { MetalLot } from '../../../domain/metal-lot';

export class IngotlineAlloyGateway implements AlloySupplierPort {
  private readonly client: sdk.IngotlineClient;

  constructor(token: string) {
    this.client = new sdk.IngotlineClient({ token });
  }

  async order(order: AlloyOrder): Promise<MetalLot> {
    try {
      const res = await this.client.placeOrder({ alloy_code: 'CUSN22', mass_kg: order.massKg, purity: 'B22' });
      return {
        lotRef: res.heat_number,
        readiness: res.dispatch_state === 'REJECTED' ? 'refused' : res.landed_date !== null ? 'arrived' : 'reserved',
        arrivalDate: res.landed_date,
      };
    } catch (e) {
      if (e instanceof sdk.IngotlineError) throw new SupplierUnavailableError(`alloy supplier unavailable: ${e.message}`);
      throw e;
    }
  }
}
