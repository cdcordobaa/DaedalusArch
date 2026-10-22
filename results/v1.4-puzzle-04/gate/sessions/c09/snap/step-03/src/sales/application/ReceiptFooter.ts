import type { MemberDirectory } from './ports/MemberDirectory';

/** The thank-you line at the bottom of a member's receipt. */
export class ReceiptFooter {
  constructor(private readonly directory: MemberDirectory) {}

  footerFor(memberId: string | null): string {
    if (memberId === null) return 'Thank you for shopping with us.';
    const member = this.directory.describe(memberId);
    return member === undefined ? 'Thank you.' : `Thank you, ${member.name}: you have ${String(member.points)} points.`;
  }
}
