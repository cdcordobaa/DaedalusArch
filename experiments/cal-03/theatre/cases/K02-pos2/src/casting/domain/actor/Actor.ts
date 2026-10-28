import { CalendarAvailabilityAdapter } from '../../infrastructure/CalendarAvailabilityAdapter';

export class Actor {
  private _name: string;
  private _engagements = 0;

  constructor(
    readonly id: string,
    name: string,
    readonly agentEmail: string,
  ) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get engagements(): number {
    return this._engagements;
  }

  setName(name: string): void {
    if (name.trim() === '') {
      throw new Error('name required');
    }
    this._name = name;
  }

  async canTake(from: number, to: number): Promise<boolean> {
    const calendar = new CalendarAvailabilityAdapter();
    return calendar.isFree(this.id, from, to);
  }

  startEngagement(): void {
    this._engagements += 1;
  }
}
