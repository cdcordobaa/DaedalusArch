import { OrderMetalPort } from '../../../application/ports/in/order-metal.port';
import { RecordTuningPort } from '../../../application/ports/in/record-tuning.port';
import { CommissionResponseDto, OrderMetalParamsDto, TuningParamsDto } from './commission.dto';

export class CommissionController {
  constructor(
    private readonly orderMetal: OrderMetalPort,
    private readonly recordTuning: RecordTuningPort,
  ) {}

  async postOrderMetal(params: OrderMetalParamsDto): Promise<CommissionResponseDto> {
    const result = await this.orderMetal.order({ commissionId: params.commissionId, comment: params.comment });
    return { commissionId: result.commissionId, status: result.status };
  }

  async postTuning(params: TuningParamsDto): Promise<{ accepted: boolean; status: string }> {
    const result = await this.recordTuning.record({ commissionId: params.commissionId, centsOff: params.centsOff });
    return { accepted: result.accepted, status: result.status };
  }
}
