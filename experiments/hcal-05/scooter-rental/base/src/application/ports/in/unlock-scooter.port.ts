export interface UnlockScooterPort {
  unlock(scooterId: string): Promise<void>;
}
