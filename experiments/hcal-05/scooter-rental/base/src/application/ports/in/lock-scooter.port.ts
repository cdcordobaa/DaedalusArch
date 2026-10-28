export interface LockScooterPort {
  lock(scooterId: string, batteryPercent: number): Promise<void>;
}
