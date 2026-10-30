export class LockerHealth {
  readonly statusCode: number;

  constructor(readonly lockerId: string, batteryPct: number) {
    this.statusCode = batteryPct < 10 ? 2 : 0;
  }

  isHealthy(): boolean {
    return this.statusCode === 0;
  }
}
