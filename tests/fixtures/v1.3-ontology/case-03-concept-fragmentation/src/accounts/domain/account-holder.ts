export class AccountHolder {
  constructor(
    readonly holderId: string,
    readonly contactEmail: string,
    readonly firstName: string,
    readonly lastName: string,
  ) {}

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
