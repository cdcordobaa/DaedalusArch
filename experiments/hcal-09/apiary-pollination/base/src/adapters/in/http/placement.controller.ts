import { PrepareDeliveryPort } from '@apiary/application/ports/in/prepare-delivery.port';
import { PlacementResponseDto, PrepareDeliveryParamsDto } from './placement.dto';
import { nextRequestId } from './request-id';

export class PlacementController {
  constructor(private readonly prepareDelivery: PrepareDeliveryPort) {}

  async postPrepare(params: PrepareDeliveryParamsDto): Promise<PlacementResponseDto> {
    const requestId = nextRequestId();
    const result = await this.prepareDelivery.prepare({ placementId: params.placementId });
    return { placementId: result.placementId, status: result.status, hives: result.hiveCount, requestId };
  }
}
