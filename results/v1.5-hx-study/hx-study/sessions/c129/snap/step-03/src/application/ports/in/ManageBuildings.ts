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
  /** No new drop goes into this locker until it is back in service. */
  outOfService(lockerId: string): { locker: string; inService: boolean };
  /** Put the locker at a bay out of service or back in service; repeating it changes nothing more. */
  setServiceAtBay(buildingId: string, bay: number, inService: boolean): { locker: string; inService: boolean };
  /** Door test: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
