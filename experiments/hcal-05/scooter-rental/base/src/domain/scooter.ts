import { ScooterUnavailableError } from './errors';

export type ScooterState = 'available' | 'in-use' | 'needs-swap';

export class Scooter {
  private state: ScooterState = 'available';
  constructor(readonly id: string, private battery: number) {
    if (battery < 15) this.state = 'needs-swap';
  }
  get batteryPercent(): number { return this.battery; }
  get currentState(): ScooterState { return this.state; }
  unlock(): void {
    if (this.state !== 'available') throw new ScooterUnavailableError(this.id);
    this.state = 'in-use';
  }
  lock(batteryPercent: number): void {
    this.battery = batteryPercent;
    this.state = batteryPercent < 15 ? 'needs-swap' : 'available';
  }
  swapBattery(): void { this.battery = 100; this.state = 'available'; }
}
