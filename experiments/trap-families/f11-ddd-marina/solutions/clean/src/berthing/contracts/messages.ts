/** Messages berthing publishes for other parts of the system. */
export interface BerthGrantedMessage {
  readonly type: 'BerthGranted';
  readonly pontoonId: string;
  readonly memberId: string;
  readonly berth: number;
  readonly lengthM: number;
}

export interface BerthRefusedMessage {
  readonly type: 'BerthRefused';
  readonly pontoonId: string;
  readonly memberId: string;
}

export interface PontoonClosedMessage {
  readonly type: 'PontoonClosed';
  readonly pontoonId: string;
  readonly occupants: readonly string[];
}
