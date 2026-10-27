import { ClinicError } from './ClinicError';

/** The patient asked not to receive texts at this number any more. */
export class RecipientOptedOut extends ClinicError {
  constructor() {
    super('the patient opted out of texts');
    this.name = 'RecipientOptedOut';
  }
}
