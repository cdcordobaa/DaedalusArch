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
}

/** What a building's latch hardware reports about a bay. */
export interface ReportLatchFaults {
  /** Put the locker at a bay out of service or back in; the same call twice changes nothing more. */
  setBayService(buildingId: string, bay: number, inService: boolean): { locker: string; inService: boolean };
}
