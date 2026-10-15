import { bus } from '../shared/bus';
// NM-AS3 (subscriber half): same component as the publisher.
export function registerAudit(): void {
  bus.on('order.audited', (id: string) => void id);
}
