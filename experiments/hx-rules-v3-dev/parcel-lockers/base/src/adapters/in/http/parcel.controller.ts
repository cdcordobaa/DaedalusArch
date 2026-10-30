import { CollectParcelPort } from '../../../application/ports/in/collect-parcel.port';
import { DomainError } from '../../../domain/errors';
import { HttpReply, replyOf } from '../shared/reply';

export interface CollectParcelBody {
  readonly parcelId: string;
  readonly pickupCode: string;
}

export class ParcelController {
  constructor(private readonly collectParcel: CollectParcelPort) {}

  async post(body: CollectParcelBody): Promise<HttpReply> {
    try {
      const result = await this.collectParcel.collect({ parcelId: body.parcelId, pickupCode: body.pickupCode });
      return replyOf(200, { parcelId: result.parcelId, state: result.state });
    } catch (e) {
      if (e instanceof DomainError) return replyOf(409, { error: e.message });
      throw e;
    }
  }
}
