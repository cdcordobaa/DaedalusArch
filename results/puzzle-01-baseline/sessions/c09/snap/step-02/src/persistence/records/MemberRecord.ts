export interface MemberRecord {
  id: string;
  name: string;
  suspended: boolean;
  /** Who imposed the current suspension; null when not suspended. */
  suspensionSource: 'staff' | 'overdue' | null;
  notices: string[];
}
