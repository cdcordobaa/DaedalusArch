export class AccountId {
  private constructor(readonly value: string) {}

  static of(value: string): AccountId {
    if (value.trim() === '') throw new Error('account id must not be empty');
    return new AccountId(value);
  }

  equals(other: AccountId): boolean {
    return other.value === this.value;
  }
}
