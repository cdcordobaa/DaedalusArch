/** Messages accounts publish for the rest of the house. */
export interface AccountSuspendedMessage {
  readonly type: 'AccountSuspended';
  readonly accountId: string;
}
