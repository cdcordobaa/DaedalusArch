import { SensorCover } from '../../../domain/sensor-cover';

export interface LeaseRequest {
  readonly yardCode: string;
  readonly hiveCount: number;
}

export interface SensorLeasePort {
  lease(request: LeaseRequest): Promise<SensorCover>;
}
