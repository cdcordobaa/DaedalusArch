import { OrderPartsPort } from '../../../application/ports/in/order-parts.port';
import { OrderPartsParamsDto, OrderPartsResponseDto } from './job.dto';

export class JobController {
  constructor(private readonly orderParts: OrderPartsPort) {}

  async postOrderParts(params: OrderPartsParamsDto): Promise<OrderPartsResponseDto> {
    const result = await this.orderParts.order({ jobId: params.jobId });
    return { jobId: result.jobId, status: result.status };
  }
}
