import { VehicleTable } from '../../persistence/VehicleTable';
import { WorkOrderTable } from '../../persistence/WorkOrderTable';
import { FleetError } from '../model/FleetError';
import { Vehicle } from '../model/Vehicle';
import { WorkOrder } from '../model/WorkOrder';

export class MaintenanceService {
  constructor(
    private readonly vehicles: VehicleTable,
    private readonly orders: WorkOrderTable,
  ) {}

  async open(plate: string, description: string, estimatedHours: number): Promise<WorkOrder> {
    if (estimatedHours <= 0 || estimatedHours > 40) {
      throw new FleetError('Estimates must be between 0 and 40 hours', 400);
    }
    const vehicle = await this.vehicle(plate);
    if ((await this.orders.openFor(plate)).length > 0) throw new FleetError(`${plate} already has an open work order`, 409);
    const order = new WorkOrder(`wo-${plate}-${Date.now()}`, plate, description, estimatedHours);
    vehicle.takeOutOfService();
    await this.vehicles.write(plate, { inService: vehicle.inService });
    await this.orders.insert({ ...order });
    return order;
  }

  async logHours(orderId: string, hours: number): Promise<WorkOrder> {
    const order = await this.order(orderId);
    order.log(hours);
    await this.orders.write(order.id, { loggedHours: order.loggedHours });
    return order;
  }

  async close(orderId: string): Promise<{ order: WorkOrder; overrun: number }> {
    const order = await this.order(orderId);
    order.finish();
    const vehicle = await this.vehicle(order.plate);
    vehicle.returnToService();
    await this.orders.write(order.id, { state: order.state });
    await this.vehicles.write(vehicle.plate, { inService: true, lastServiceKm: vehicle.lastServiceKm });
    return { order, overrun: order.overrun() };
  }

  private async vehicle(plate: string): Promise<Vehicle> {
    const r = await this.vehicles.row(plate);
    if (r === null) throw new FleetError(`Unknown vehicle ${plate}`, 404);
    return new Vehicle(r.plate, r.model, r.odometerKm, r.inService, r.lastServiceKm);
  }

  private async order(id: string): Promise<WorkOrder> {
    const r = await this.orders.row(id);
    if (r === null) throw new FleetError(`Unknown work order ${id}`, 404);
    return new WorkOrder(r.id, r.plate, r.description, r.estimatedHours, r.loggedHours, r.state === 'done' ? 'done' : 'open');
  }
}
