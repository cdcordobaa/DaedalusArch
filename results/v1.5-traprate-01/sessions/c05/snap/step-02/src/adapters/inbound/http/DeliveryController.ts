import type { FindPickupPoints } from '../../../application/ports/in/FindPickupPoints';
import type { ScheduleDelivery } from '../../../application/ports/in/ScheduleDelivery';

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** POST /deliveries and GET /pickup-points?postcode=&country=. */
export class DeliveryController {
  constructor(
    private readonly deliveries: ScheduleDelivery,
    private readonly pickupPoints: FindPickupPoints,
  ) {}

  async postDelivery(body: Record<string, unknown>): Promise<HttpResponse> {
    try {
      const view = await this.deliveries.schedule({
        orderId: String(body.orderId ?? ''),
        street: String(body.street ?? ''),
        postcode: String(body.postcode ?? ''),
        city: String(body.city ?? ''),
        country: String(body.country ?? ''),
      });
      return { status: 200, body: view };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async getPickupPoints(query: Record<string, string | undefined>): Promise<HttpResponse> {
    try {
      return { status: 200, body: await this.pickupPoints.near(query.postcode ?? '', query.country ?? '') };
    } catch (e) {
      return { status: 400, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }
}
