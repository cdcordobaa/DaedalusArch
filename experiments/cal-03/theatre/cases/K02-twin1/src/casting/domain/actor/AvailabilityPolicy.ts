export interface AvailabilityPolicy {
  isFree(actorId: string, from: number, to: number): Promise<boolean>;
}
