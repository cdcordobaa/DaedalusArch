export class MembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MembershipError';
  }
}
