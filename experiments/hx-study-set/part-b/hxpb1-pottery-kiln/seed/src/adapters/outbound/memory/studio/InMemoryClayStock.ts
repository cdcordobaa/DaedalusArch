import type { ClayBag } from '../../../../domain/model/studio/ClayBag';
import type { ClayStock } from '../../../../application/ports/out/studio/ClayStock';

export class InMemoryClayStock implements ClayStock {
  private readonly bags = new Map<string, ClayBag>();

  async load(clayBody: string): Promise<ClayBag | null> {
    return this.bags.get(clayBody) ?? null;
  }

  async store(bag: ClayBag): Promise<void> {
    this.bags.set(bag.clayBody, bag);
  }
}
