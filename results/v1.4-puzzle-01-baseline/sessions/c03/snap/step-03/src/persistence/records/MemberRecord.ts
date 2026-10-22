export interface MemberRecord {
  id: string;
  name: string;
  suspended: boolean;
  /** True when staff suspended the member; such a suspension is not lifted automatically. */
  suspendedByStaff: boolean;
  notices: string[];
}
