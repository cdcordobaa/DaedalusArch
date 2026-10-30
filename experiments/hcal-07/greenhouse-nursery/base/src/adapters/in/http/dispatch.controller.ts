import { BookFreightPort } from '../../../application/ports/in/book-freight.port';
import { DispatchNotFoundError, FreightRefusedError } from '../../../domain/errors';
import { BookFreightParamsDto, DispatchResponseDto, HttpReply } from './dispatch.dto';

export class DispatchController {
  constructor(private readonly bookFreight: BookFreightPort) {}

  async postFreight(params: BookFreightParamsDto): Promise<HttpReply<DispatchResponseDto>> {
    try {
      const result = await this.bookFreight.book({ dispatchId: params.dispatchId, collectionDate: params.collectionDate });
      return { status: 201, body: { dispatchId: result.dispatchId, status: result.status } };
    } catch (e) {
      if (e instanceof DispatchNotFoundError) return { status: 404, body: { dispatchId: params.dispatchId, status: 'UNKNOWN', error: e.message } };
      if (e instanceof FreightRefusedError) return { status: 409, body: { dispatchId: params.dispatchId, status: 'ORDERED', error: e.refusal } };
      throw e;
    }
  }
}
