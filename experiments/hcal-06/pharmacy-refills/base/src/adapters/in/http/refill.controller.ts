import { RequestRefillPort } from '../../../application/ports/in/request-refill.port';
import { RequestRefillParamsDto, RequestRefillResponseDto } from './refill.dto';

export class RefillController {
  constructor(private readonly requestRefill: RequestRefillPort) {}

  async post(params: RequestRefillParamsDto): Promise<RequestRefillResponseDto> {
    const result = await this.requestRefill.request({ refillId: params.refillId });
    return { refillId: result.refillId, status: result.state, copay: (result.copayCents / 100).toFixed(2) };
  }
}
