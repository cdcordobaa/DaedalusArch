import { StudioError } from '../../../domain/errors/StudioError';
import type { ClayBag } from '../../../domain/model/studio/ClayBag';
import type { ClayStock } from '../../ports/out/studio/ClayStock';

/** Clay coming in from the supplier and going out to the wheels. */
export class ClayStockService {
  constructor(private readonly stock: ClayStock) {}

  async receive(clayBody: string, kilos: number): Promise<ClayBag> {
    if (!(kilos > 0)) throw new StudioError('a delivery has a positive weight');
    const now = (await this.stock.load(clayBody))?.kilos ?? 0;
    const bag = { clayBody, kilos: now + kilos };
    await this.stock.store(bag);
    return bag;
  }

  async takeOut(clayBody: string, kilos: number): Promise<ClayBag> {
    const bag = await this.stock.load(clayBody);
    if (bag === null || bag.kilos < kilos) throw new StudioError('not enough ' + clayBody + ' in stock');
    const left = { clayBody, kilos: bag.kilos - kilos };
    await this.stock.store(left);
    return left;
  }
}
