import { WithdrawSignUp } from './application/WithdrawSignUp';
import { GetSignUp } from './application/GetSignUp';
import { RequestSignUp } from './application/RequestSignUp';
import type { ShiftDirectory } from './application/ports/ShiftDirectory';
import type { SignUpView } from './contracts/SignUpView';
import type { SignUpRepository } from './domain/signup/SignUpRepository';

export type { SignUpView } from './contracts/SignUpView';

/** What the rest of the system may call. */
export interface SignUpsModule {
  request(volunteer: string, shiftId: string, places: number): string;
  signUp(signUpId: string): SignUpView | undefined;
  withdraw(signUpId: string): void;
}

export function createSignUps(signUps: SignUpRepository, shifts: ShiftDirectory): SignUpsModule {
  return {
    request: (volunteer, shiftId, places) => new RequestSignUp(signUps, shifts).execute(volunteer, shiftId, places),
    signUp: (signUpId) => new GetSignUp(signUps, shifts).execute(signUpId),
    withdraw: (signUpId) => new WithdrawSignUp(signUps, shifts).execute(signUpId),
  };
}
