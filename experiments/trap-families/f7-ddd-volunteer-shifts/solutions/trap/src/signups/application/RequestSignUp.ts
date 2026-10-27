import { SignUpError } from '../domain/SignUpError';
import { SignUp } from '../domain/signup/SignUp';
import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import type { ShiftDirectory } from './ports/ShiftDirectory';

export class RequestSignUp {
  constructor(
    private readonly signUps: SignUpRepository,
    private readonly shifts: ShiftDirectory,
  ) {}

  execute(volunteer: string, shiftId: string, places: number): string {
    if (!this.shifts.exists(shiftId)) throw new SignUpError(`no shift ${shiftId}`);
    const signUp = SignUp.request(this.signUps.nextId(), volunteer, shiftId, places);
    try {
      this.shifts.holdPlaces(shiftId, signUp.id.value, places);
      signUp.confirm();
    } catch {
      signUp.reject();
    }
    this.signUps.save(signUp);
    return signUp.id.value;
  }
}
