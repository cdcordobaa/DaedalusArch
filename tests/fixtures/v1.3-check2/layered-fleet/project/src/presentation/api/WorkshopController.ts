import { MaintenanceService } from '../../business/services/MaintenanceService';
import { MileageService } from '../../business/services/MileageService';
import { workOrderJson } from '../format/workOrder';

export interface OpenOrderInput {
  plate: string;
  description: string;
  estimatedHours: number;
}

export interface HoursInput {
  hours: number;
}

export interface MileageInput {
  plate: string;
  km: number;
  lastServiceKm: number;
}

export class WorkshopController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly mileage: MileageService,
  ) {}

  async openOrder(input: OpenOrderInput): Promise<Record<string, string | number>> {
    const order = await this.maintenance.open(input.plate, input.description, input.estimatedHours);
    return workOrderJson(order);
  }

  async logHours(orderId: string, input: HoursInput): Promise<Record<string, string | number>> {
    return workOrderJson(await this.maintenance.logHours(orderId, input.hours));
  }

  async closeOrder(orderId: string): Promise<Record<string, string | number>> {
    const { order, overrun } = await this.maintenance.close(orderId);
    return { ...workOrderJson(order), overrun };
  }

  async reading(input: MileageInput): Promise<{ serviceDue: boolean }> {
    const serviceDue = await this.mileage.record(input.plate, input.km, input.lastServiceKm);
    return { serviceDue };
  }
}
