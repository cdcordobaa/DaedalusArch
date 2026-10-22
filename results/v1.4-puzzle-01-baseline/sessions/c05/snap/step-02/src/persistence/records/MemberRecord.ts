export interface MemberRecord {
  id: string;
  name: string;
  suspended: boolean;
  /** Who suspended the member; null while not suspended. */
  suspendedBy: 'staff' | 'overdue' | null;
  notices: string[];
}
