export interface RegisterPilotCommand {
  name: string;
  licenceNo: string;
  weeklyHourCap: number;
}

export interface PilotDto {
  id: string;
  name: string;
  licenceNo: string;
  weeklyHourCap: number;
  assignedHours: number;
  preferredDroneId: string | null;
}

export interface RegisterDroneCommand {
  model: string;
  maxFlightMinutes: number;
}

export interface DroneDto {
  id: string;
  model: string;
  status: string;
}
