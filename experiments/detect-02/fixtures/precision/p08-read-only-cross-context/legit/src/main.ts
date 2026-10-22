import { createMembership } from './membership';
import { InMemoryMemberRepository } from './membership/infrastructure/InMemoryMemberRepository';
import { MembershipDirectory } from './sales/acl/MembershipDirectory';
import { PlaceOrder } from './sales/application/PlaceOrder';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  const membership = createMembership(new InMemoryMemberRepository());
  return { placeOrder: new PlaceOrder(new InMemoryOrderRepository(), new MembershipDirectory(membership)) };
}
