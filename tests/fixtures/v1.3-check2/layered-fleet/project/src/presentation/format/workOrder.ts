import { WorkOrder } from '../../business/model/WorkOrder';

export function workOrderJson(order: WorkOrder): Record<string, string | number> {
  return { id: order.id, vehicle: order.plate, state: order.state, hours: `${order.loggedHours}/${order.estimatedHours}` };
}
