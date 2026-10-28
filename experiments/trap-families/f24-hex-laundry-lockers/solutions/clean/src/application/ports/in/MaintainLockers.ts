/** What a building manager does with a single locker. */
export interface MaintainLockers {
  /** No new drop goes into this locker until it is back in service. */
  outOfService(lockerId: string): { locker: string; inService: boolean };
  /** The door test after a repair: pulse the latch and say whether the door opened. */
  testDoor(lockerId: string): { locker: string; opened: boolean };
}
