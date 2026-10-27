/** Messages membership publishes for other parts of the system. */
export interface MemberJoinedMessage {
  readonly type: 'MemberJoined';
  readonly memberId: string;
  readonly owner: string;
  readonly boatName: string;
  readonly boatLengthM: number;
}
