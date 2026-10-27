import type { SignUpView } from '../contracts/SignUpView';
import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import { SignUpId } from '../domain/signup/value-objects/SignUpId';

export class GetSignUp {
  constructor(private readonly signUps: SignUpRepository) {}

  execute(signUpId: string): SignUpView | undefined {
    const signUp = this.signUps.byId(SignUpId.of(signUpId));
    if (signUp === undefined) return undefined;
    return { id: signUp.id.value, volunteer: signUp.volunteer, shiftId: signUp.shiftId, places: signUp.places, status: signUp.status };
  }
}
