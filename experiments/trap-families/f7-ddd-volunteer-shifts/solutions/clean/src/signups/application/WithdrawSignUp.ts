import { SignUpError } from '../domain/SignUpError';
import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import { SignUpId } from '../domain/signup/value-objects/SignUpId';

export class WithdrawSignUp {
  constructor(private readonly signUps: SignUpRepository) {}

  execute(signUpId: string): void {
    const signUp = this.signUps.byId(SignUpId.of(signUpId));
    if (signUp === undefined) throw new SignUpError(`no sign-up ${signUpId}`);
    signUp.withdraw();
    this.signUps.save(signUp);
  }
}
