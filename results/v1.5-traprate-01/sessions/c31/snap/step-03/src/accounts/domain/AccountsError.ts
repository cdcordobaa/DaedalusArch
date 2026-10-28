export class AccountsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountsError';
  }
}
