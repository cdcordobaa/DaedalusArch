import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { SignUpError } from '../SignUpError';
import { SignUpRequested } from './events/SignUpRequested';
import type { SignUpId } from './value-objects/SignUpId';

export type SignUpStatus = 'requested';

/** Places one volunteer may take at once (the volunteer with family or friends who come along). */
const MAX_PLACES = 6;

export interface SignUpState {
  readonly id: SignUpId;
  readonly volunteer: string;
  readonly shiftId: string;
  readonly places: number;
  readonly status: SignUpStatus;
}

/** A volunteer's sign-up for one shift: 1 to 6 places. */
export class SignUp {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: SignUpId,
    readonly volunteer: string,
    readonly shiftId: string,
    readonly places: number,
    private current: SignUpStatus,
  ) {}

  static request(id: SignUpId, volunteer: string, shiftId: string, places: number): SignUp {
    if (volunteer.trim() === '') throw new SignUpError('a sign-up needs a volunteer name');
    if (!Number.isInteger(places) || places < 1 || places > MAX_PLACES) throw new SignUpError(`a sign-up is for 1 to ${String(MAX_PLACES)} places`);
    const signUp = new SignUp(id, volunteer, shiftId, places, 'requested');
    signUp.pending.push(new SignUpRequested(id.value, shiftId, volunteer, places));
    return signUp;
  }

  static restore(state: SignUpState): SignUp {
    return new SignUp(state.id, state.volunteer, state.shiftId, state.places, state.status);
  }

  get status(): SignUpStatus {
    return this.current;
  }

  state(): SignUpState {
    return { id: this.id, volunteer: this.volunteer, shiftId: this.shiftId, places: this.places, status: this.current };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
