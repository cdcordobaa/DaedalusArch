import { ClinicError } from './ClinicError';

/** The number cannot receive texts right now (for example the phone carrier blocks it); it may work another time. */
export class RecipientUnreachable extends ClinicError {
  constructor() {
    super('the number cannot receive texts now');
    this.name = 'RecipientUnreachable';
  }
}
