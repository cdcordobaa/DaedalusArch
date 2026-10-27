import type { Outbox } from '../../messaging/Outbox';
import type { DomainEvent } from '../../shared-kernel/DomainEvent';
import { SignUp, type SignUpState } from '../domain/signup/SignUp';
import type { SignUpRepository } from '../domain/signup/SignUpRepository';
import { SignUpId } from '../domain/signup/value-objects/SignUpId';

/** Sign-ups and their outbox in one store: saving a sign-up stores its pending events in the same step. */
export class InMemorySignUpRepository implements SignUpRepository, Outbox {
  private readonly rows = new Map<string, SignUpState>();
  private outbox: DomainEvent[] = [];
  private sequence = 0;

  nextId(): SignUpId {
    this.sequence += 1;
    return SignUpId.of(`U-${String(this.sequence).padStart(4, '0')}`);
  }

  byId(id: SignUpId): SignUp | undefined {
    const row = this.rows.get(id.value);
    return row === undefined ? undefined : SignUp.restore(row);
  }

  save(signUp: SignUp): void {
    const events = signUp.pullEvents();
    this.rows.set(signUp.id.value, signUp.state());
    this.outbox = [...this.outbox, ...events];
  }

  takePending(): DomainEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }
}
