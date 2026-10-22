import { AddLine } from './sales/application/AddLine';
import { InMemoryOrderRepository } from './sales/infrastructure/InMemoryOrderRepository';
import { InMemoryProductRepository } from './sales/infrastructure/InMemoryProductRepository';

export function createApp() {
  return { addLine: new AddLine(new InMemoryOrderRepository(), new InMemoryProductRepository()) };
}
