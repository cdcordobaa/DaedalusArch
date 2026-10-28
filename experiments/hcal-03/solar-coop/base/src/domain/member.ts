import { DomainError } from './errors';

export class Member {
  constructor(
    readonly id: string,
    private _name: string,
    private _email: string,
  ) {}
  get name(): string {
    return this._name;
  }
  get email(): string {
    return this._email;
  }
  changeEmail(email: string): void {
    if (!email.includes('@')) throw new DomainError('invalid email');
    this._email = email;
  }
}
