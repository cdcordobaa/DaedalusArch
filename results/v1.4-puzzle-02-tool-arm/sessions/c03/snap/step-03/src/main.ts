import { createMembership } from './membership';
import { InMemoryMemberRepository } from './membership/infrastructure/InMemoryMemberRepository';
import { MembershipDirectory } from './sales/acl/MembershipDirectory';
import { MembershipPoints } from './sales/acl/MembershipPoints';
import { EarnPoints } from './sales/application/EarnPoints';
import { EventRelay } from './sales/application/EventRelay';
import { PlaceOrder, type LineRequest, type PlacedOrder } from './sales/application/PlaceOrder';
import { ReceiptFooter } from './sales/application/ReceiptFooter';
import { SendReceipt } from './sales/application/SendReceipt';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';
import { InMemoryReceipts } from './sales/infrastructure/InMemoryReceipts';

/** Composition root. Every command delivers the events it stored before it returns. */
export function createApp() {
  const members = new InMemoryMemberRepository();
  const membership = createMembership(members);
  const orders = new InMemoryOrderRepository();
  const receipts = new InMemoryReceipts();
  const relay = new EventRelay(orders);
  const sendReceipt = new SendReceipt(receipts, new ReceiptFooter(members));
  const earnPoints = new EarnPoints(new MembershipPoints(membership));
  relay.on('OrderPlaced', (e) => earnPoints.handle(e));
  relay.on('OrderPlaced', (e) => sendReceipt.handle(e));
  const command = <T>(run: () => T): T => {
    const result = run();
    relay.deliverPending();
    return result;
  };
  return {
    enrol: (name: string): string => membership.enrol(name),
    awardPoints: (memberId: string, points: number): void => membership.awardPoints(memberId, points),
    memberCard: (memberId: string) => membership.card(memberId),
    placeOrder: (memberId: string | null, lines: LineRequest[]): PlacedOrder =>
      command(() => new PlaceOrder(orders, new MembershipDirectory(membership)).execute(memberId, lines)),
    receipts: (): string[] => receipts.all(),
  };
}
