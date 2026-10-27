import { TenancyError } from './TenancyError';

/** The signature service would not accept one of the agreement's email addresses. */
export class EmailRefused extends TenancyError {
  constructor(readonly email: string) {
    super(`Inkwell could not accept the email ${email}.`);
    this.name = 'EmailRefused';
  }
}
