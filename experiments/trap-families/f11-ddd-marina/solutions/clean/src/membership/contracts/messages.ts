/** Messages membership publishes for other parts of the system. */
export interface MemberJoinedMessage {
  readonly type: 'MemberJoined';
  readonly memberId: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
}

export interface ContractRequestedMessage {
  readonly type: 'ContractRequested';
  readonly memberId: string;
  readonly pontoonId: string;
  readonly boatLengthM: number;
}

export interface MemberResignedMessage {
  readonly type: 'MemberResigned';
  readonly memberId: string;
  readonly pontoonId: string | null;
}
