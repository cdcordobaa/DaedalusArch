export const SERVICE_INTERVAL_KM = 15_000;

export class Vehicle {
  plate: string;
  model: string;
  odometerKm: number;
  inService: boolean;
  lastServiceKm: number;

  constructor(plate: string, model: string, odometerKm: number, inService: boolean, lastServiceKm: number) {
    this.plate = plate;
    this.model = model;
    this.odometerKm = odometerKm;
    this.inService = inService;
    this.lastServiceKm = lastServiceKm;
  }

  serviceDue(): boolean {
    return this.odometerKm - this.lastServiceKm >= SERVICE_INTERVAL_KM;
  }

  takeOutOfService(): void {
    this.inService = false;
  }

  returnToService(): void {
    this.inService = true;
    this.lastServiceKm = this.odometerKm;
  }
}
