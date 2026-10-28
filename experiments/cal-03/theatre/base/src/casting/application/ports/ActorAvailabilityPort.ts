export interface ActorAvailabilityPort {
  isFree(actorId: string, from: number, to: number): Promise<boolean>;
}
