import { createShifts } from './shifts';
import { InMemoryShiftRepository } from './shifts/infrastructure/InMemoryShiftRepository';
import { EventRelay } from './messaging/EventRelay';
import { ShiftsDirectory } from './signups/acl/ShiftsDirectory';
import { NotifyCoordinator } from './signups/application/NotifyCoordinator';
import { createSignUps } from './signups';
import { InMemoryCoordinatorNotices } from './signups/infrastructure/InMemoryCoordinatorNotices';
import { InMemorySignUpRepository } from './signups/infrastructure/InMemorySignUpRepository';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const shiftStore = new InMemoryShiftRepository();
  const signUpStore = new InMemorySignUpRepository();
  const notices = new InMemoryCoordinatorNotices();
  const shifts = createShifts(shiftStore);
  const signUps = createSignUps(signUpStore, new ShiftsDirectory(shifts));
  const relay = new EventRelay([shiftStore, signUpStore]);
  const notifyCoordinator = new NotifyCoordinator(notices);
  relay.on('SignUpRequested', (e) => notifyCoordinator.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    openShift: (name: string, places: number): string => command(() => shifts.open(name, places)),
    shift: (shiftId: string) => shifts.shift(shiftId),
    blockPlaces: (shiftId: string, group: string, places: number): void => command(() => shifts.holdPlaces(shiftId, group, places)),
    releaseBlock: (shiftId: string, group: string): void => command(() => shifts.releasePlaces(shiftId, group)),
    signUp: (volunteer: string, shiftId: string, places: number): string => command(() => signUps.request(volunteer, shiftId, places)),
    signUpRecord: (signUpId: string) => signUps.signUp(signUpId),
    coordinatorNotices: (): string[] => notices.all(),
    withdraw: (signUpId: string): void => command(() => signUps.withdraw(signUpId)),
    cancelShift: (shiftId: string): void => command(() => shifts.cancel(shiftId)),
  };
}
