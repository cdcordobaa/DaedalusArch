declare module '@prisma/client' {
  export interface VehicleRow { plate: string; model: string; odometerKm: number; inService: boolean; lastServiceKm: number }
  export interface WorkOrderRow { id: string; plate: string; description: string; estimatedHours: number; loggedHours: number; state: string }
  export interface MileageRow { id: string; plate: string; km: number; readAt: Date }
  export interface Delegate<T, K extends keyof T> {
    findUnique(args: { where: Pick<T, K> }): Promise<T | null>;
    findMany(args?: { where?: Partial<T> }): Promise<T[]>;
    create(args: { data: T }): Promise<T>;
    update(args: { where: Pick<T, K>; data: Partial<T> }): Promise<T>;
  }
  export class PrismaClient {
    vehicle: Delegate<VehicleRow, 'plate'>;
    workOrder: Delegate<WorkOrderRow, 'id'>;
    mileage: Delegate<MileageRow, 'id'>;
    $connect(): Promise<void>;
  }
}
