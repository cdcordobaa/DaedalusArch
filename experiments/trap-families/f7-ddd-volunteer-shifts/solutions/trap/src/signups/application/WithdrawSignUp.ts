import { SignUpError } from '../domain/SignUpError';
import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import { SignUpId } from '../domain/signup/value-objects/SignUpId';
import type { ShiftDirectory } from './ports/ShiftDirectory';

export class WithdrawSignUp {
  constructor(
    private readonly signUps: SignUpRepository,
    private readonly shifts: ShiftDirectory,
  ) {}

  execute(signUpId: string): void {
    const signUp = this.signUps.byId(SignUpId.of(signUpId));
    if (signUp === undefined) throw new SignUpError(`no sign-up ${signUpId}`);
    if (signUp.withdraw()) this.shifts.releasePlaces(signUp.shiftId, signUp.id.value);
    this.signUps.save(signUp);
  }
}
