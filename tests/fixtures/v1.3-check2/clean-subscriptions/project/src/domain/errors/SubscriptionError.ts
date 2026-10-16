export class SubscriptionError extends Error {
  constructor(readonly code: 'not-found' | 'invalid' | 'state', message: string) {
    super(message);
  }
}
