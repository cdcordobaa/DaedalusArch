export interface VehicleRecord {
  plate: string;
  model: string;
  odometerKm: number;
  inService: boolean;
  lastServiceKm: number;
}

export interface WorkOrderRecord {
  id: string;
  plate: string;
  description: string;
  estimatedHours: number;
  loggedHours: number;
  state: string;
}

export interface MileageRecord {
  id: string;
  plate: string;
  km: number;
  readAt: Date;
}
