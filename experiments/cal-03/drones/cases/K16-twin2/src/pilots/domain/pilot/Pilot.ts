import { Assignment } from './value-objects/Assignment';
import { DroneSpec } from './value-objects/DroneSpec';

export class Pilot {
  private _assignments: Assignment[] = [];
  private _flightHours = 0;
  private _preferredDroneId: string | null = null;
  private _droneSpec: DroneSpec | null = null;

  private constructor(
    readonly id: string,
    readonly name: string,
    readonly licenceNo: string,
    readonly weeklyHourCap: number,
  ) {}

  static register(id: string, name: string, licenceNo: string, weeklyHourCap: number): Pilot {
    if (licenceNo.trim() === '') {
      throw new Error('a pilot needs a licence number');
    }
    if (!(weeklyHourCap > 0)) {
      throw new Error('weekly hour cap must be positive');
    }
    return new Pilot(id, name, licenceNo, weeklyHourCap);
  }

  get assignments(): readonly Assignment[] {
    return this._assignments;
  }

  get assignedHours(): number {
    return this._assignments.reduce((sum, a) => sum + a.hours, 0);
  }

  get flightHours(): number {
    return this._flightHours;
  }

  get preferredDroneId(): string | null {
    return this._preferredDroneId;
  }

  assign(surveyId: string, hours: number): void {
    if (!(hours > 0)) {
      throw new Error('assignment hours must be positive');
    }
    if (this._assignments.some((a) => a.surveyId === surveyId)) {
      throw new Error('pilot already assigned to this survey');
    }
    if (this.assignedHours + hours > this.weeklyHourCap) {
      throw new Error('weekly hour cap exceeded');
    }
    this._assignments = [...this._assignments, new Assignment(surveyId, hours)];
  }

  release(surveyId: string): void {
    this._assignments = this._assignments.filter((a) => a.surveyId !== surveyId);
  }

  logFlight(hours: number): void {
    if (!(hours > 0)) {
      throw new Error('flight hours must be positive');
    }
    this._flightHours += hours;
  }

  get droneSpec(): DroneSpec | null {
    return this._droneSpec;
  }

  useDrone(spec: DroneSpec): void {
    this._droneSpec = spec;
  }

  preferDrone(droneId: string): void {
    this._preferredDroneId = droneId;
  }
}
