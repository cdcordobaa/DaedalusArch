import { PalletPathClient, PalletPathOutage, PalletPathRejection, RejectCode } from 'palletpath-sdk';
import { FreightCarrierPort, FreightRequest } from '../../../application/ports/out/freight-carrier.port';
import { CarrierUnavailableError, FreightRefusedError } from '../../../domain/errors';
import { FreightBooking, FreightRefusal } from '../../../domain/freight';
import { FREIGHT_FIELDS } from './freight-fields';

export class PalletPathFreightGateway implements FreightCarrierPort {
  private readonly client: PalletPathClient;

  constructor(accountToken: string) {
    this.client = new PalletPathClient({ account_token: accountToken });
  }

  async book(request: FreightRequest): Promise<FreightBooking> {
    try {
      const res = await this.client.book({
        sender_account: 'GREENHOUSE-01',
        [FREIGHT_FIELDS.postcode]: request.postcode,
        [FREIGHT_FIELDS.pallets]: request.pallets,
        [FREIGHT_FIELDS.weightKg]: request.weightKg,
        [FREIGHT_FIELDS.collectionDate]: request.collectionDate,
      });
      return { freightRef: res.consignment_no, depot: res.delivery_depot };
    } catch (e) {
      if (e instanceof PalletPathRejection) throw new FreightRefusedError(this.toRefusal(e.reject_code));
      if (e instanceof PalletPathOutage) throw new CarrierUnavailableError(`carrier unavailable: ${e.message}`);
      throw e;
    }
  }

  private toRefusal(code: RejectCode): FreightRefusal {
    switch (code) {
      case 'RJ_OVERWEIGHT': return 'too-heavy';
      case 'RJ_POSTCODE_UNSERVED': return 'area-not-served';
      case 'RJ_LIVE_PLANTS_EMBARGO': return 'plants-restricted';
      case 'RJ_NO_COLLECTION_SLOT': return 'no-slot';
    }
  }
}
