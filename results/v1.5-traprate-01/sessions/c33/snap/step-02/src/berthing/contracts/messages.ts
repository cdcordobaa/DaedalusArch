/** Messages berthing publishes for other parts of the system. */
export interface PontoonClosedMessage {
  readonly type: 'PontoonClosed';
  readonly pontoonId: string;
}
