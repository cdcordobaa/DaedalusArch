export type DoorState = 'DOOR_OPEN' | 'DOOR_SHUT' | 'DOOR_JAMMED';
export type LockerFault = 'LB_OFFLINE' | 'LB_POWER' | 'LB_TAMPER';

export interface DoorReport {
  locker_id: string;
  door_state: DoorState;
  opened_at: string;
  battery_pct: number;
}

export class LockboxTimeout extends Error {
  fault: LockerFault;
}

export class LockboxClient {
  constructor(options: { token: string });
  openDoor(lockerId: string): Promise<DoorReport>;
}
