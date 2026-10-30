export interface LockerDoorPort {
  open(lockerId: string): Promise<void>;
}
