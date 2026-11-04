import { SensorCover } from '../../../domain/sensor-cover';

export interface LeaseRequest {
  readonly yardCode: string;
  readonly units: number;
}

export interface SensorLeasePort {
  lease(request: LeaseRequest): Promise<SensorCover>;
}
