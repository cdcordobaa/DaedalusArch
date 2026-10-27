import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import { SignUpId } from '../domain/signup/value-objects/SignUpId';

/** Handles the shift's answer to a sign-up's request for places. */
export class SettleSignUp {
  constructor(private readonly signUps: SignUpRepository) {}

  execute(signUpId: string, held: boolean): void {
    const signUp = this.signUps.byId(SignUpId.of(signUpId));
    if (signUp === undefined) return;
    if (held) signUp.confirm();
    else signUp.reject();
    this.signUps.save(signUp);
  }
}
