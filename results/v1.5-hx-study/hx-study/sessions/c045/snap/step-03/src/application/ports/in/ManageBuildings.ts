export interface LockerLine {
  readonly id: string;
  readonly bay: number;
  readonly size: string;
  readonly inService: boolean;
  readonly free: boolean;
}

/** What building managers do: register buildings, install lockers, look at the bank. */
export interface ManageBuildings {
  addBuilding(name: string): { id: string };
  installLocker(buildingId: string, bay: number, size: string): { id: string };
  lockers(buildingId: string): LockerLine[];
  outOfService(lockerId: string): { locker: string; inService: boolean };
  /** A latch fault report from the hardware: out of service on a fault, back in service when cleared. */
  setLatchFault(buildingId: string, bay: number, faulty: boolean): { locker: string; inService: boolean };
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
