import { CancelDispatchPort, CancelDispatchResult } from './ports/in/cancel-dispatch.port';
import { DispatchRepositoryPort } from './ports/out/dispatch-repository.port';

export class CancelDispatchUseCase implements CancelDispatchPort {
  constructor(private readonly orders: DispatchRepositoryPort) {}

  async cancel(dispatchId: string): Promise<CancelDispatchResult> {
    const order = await this.orders.findById(dispatchId);
    if (order === null) return { status: 404 };
    if (!order.cancel()) return { status: 409 };
    await this.orders.save(order);
    return { status: 204 };
  }
}
