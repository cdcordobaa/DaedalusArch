import { HaulService } from '../application/HaulService';
import { HaulDto } from '../contracts/HaulDto';
import { AllowanceExceededError } from '../domain/truck/AllowanceExceededError';

export type RecordHaulResponse = { status: 201; body: HaulDto } | { status: 409; error: string };

export class HaulController {
  constructor(private readonly hauls: HaulService) {}

  async postHaul(body: { truckId: string; orderId: string; shiftDate: string }): Promise<RecordHaulResponse> {
    try {
      return { status: 201, body: await this.hauls.recordHaul(body.truckId, body.orderId, body.shiftDate) };
    } catch (e) {
      if (e instanceof AllowanceExceededError) return { status: 409, error: e.message };
      throw e;
    }
  }
}
