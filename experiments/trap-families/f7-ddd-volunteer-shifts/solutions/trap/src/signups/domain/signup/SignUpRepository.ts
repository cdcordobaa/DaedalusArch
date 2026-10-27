import type { SignUp } from './SignUp';
import type { SignUpId } from './value-objects/SignUpId';

export interface SignUpRepository {
  nextId(): SignUpId;
  byId(id: SignUpId): SignUp | undefined;
  /** Stores the sign-up and its pending events in one step. */
  save(signUp: SignUp): void;
}
