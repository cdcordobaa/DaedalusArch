import { AddLine } from './sales/application/AddLine';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';

export function createApp() {
  return { addLine: new AddLine(new InMemoryOrderRepository()) };
}
