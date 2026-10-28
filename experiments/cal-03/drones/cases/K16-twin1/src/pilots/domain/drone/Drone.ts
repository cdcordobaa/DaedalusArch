export type DroneStatus = 'available' | 'in-use' | 'maintenance';

export class Drone {
  private _status: DroneStatus = 'available';
  private _operatorId: string | null = null;

  private constructor(
    readonly id: string,
    readonly model: string,
    readonly maxFlightMinutes: number,
  ) {}

  static register(id: string, model: string, maxFlightMinutes: number): Drone {
    if (!(maxFlightMinutes > 0)) {
      throw new Error('flight endurance must be positive');
    }
    return new Drone(id, model, maxFlightMinutes);
  }

  get status(): DroneStatus {
    return this._status;
  }

  get operatorId(): string | null {
    return this._operatorId;
  }

  assignOperator(pilotId: string): void {
    this._operatorId = pilotId;
  }

  checkOut(): void {
    if (this._status !== 'available') {
      throw new Error('drone is not available');
    }
    this._status = 'in-use';
  }

  checkIn(): void {
    this._status = 'available';
  }

  sendToMaintenance(): void {
    this._status = 'maintenance';
  }
}
