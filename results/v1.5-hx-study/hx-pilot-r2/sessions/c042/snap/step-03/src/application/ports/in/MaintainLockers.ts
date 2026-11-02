/** What managers do to a single locker: switch it out of service and test its door. */
export interface MaintainLockers {
  outOfService(lockerId: string): { locker: string; inService: boolean };
  /** Put the locker at a bay out of service or back in service; repeating it changes nothing more. */
  setServiceAtBay(buildingId: string, bay: number, inService: boolean): { locker: string; inService: boolean };
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
