import { bus } from '../shared/bus';
// NM-AS4: the spec allows audit-log to react to orders (allowedAsync: audit-log->orders).
export function listen(): void {
  bus.on('order.placed', (id: string) => void id);
}
