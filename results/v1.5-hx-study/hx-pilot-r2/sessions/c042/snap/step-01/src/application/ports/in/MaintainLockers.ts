/** What managers do to a single locker: switch it out of service and test its door. */
export interface MaintainLockers {
  outOfService(lockerId: string): { locker: string; inService: boolean };
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
