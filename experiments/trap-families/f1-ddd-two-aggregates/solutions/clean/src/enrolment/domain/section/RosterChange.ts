export type RosterChangeKind = 'enrolled' | 'dropped' | 'switched-in' | 'switched-out';

export interface RosterChange {
  readonly kind: RosterChangeKind;
  readonly studentId: string;
  readonly otherSection: string | null;
}
