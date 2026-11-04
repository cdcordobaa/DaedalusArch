import { HaulService } from '../application/HaulService';
import { HaulDto } from '../contracts/HaulDto';

export type RecordHaulResponse = { status: 201; body: HaulDto } | { status: 409; error: string };

export class HaulController {
  constructor(private readonly hauls: HaulService) {}

  async postHaul(body: { truckId: string; orderId: string; shiftDate: string }): Promise<RecordHaulResponse> {
    const result = await this.hauls.recordHaul(body.truckId, body.orderId, body.shiftDate);
    return result.ok ? { status: 201, body: result.haul } : { status: 409, error: result.reason };
  }
}
