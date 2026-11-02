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
  /** Out of service (as the manager's switch) or back in service, for the locker at a bay. Repeating it changes nothing more. */
  setServiceAtBay(buildingId: string, bay: number, inService: boolean): { locker: string; inService: boolean };
  /** Door test after a repair: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
