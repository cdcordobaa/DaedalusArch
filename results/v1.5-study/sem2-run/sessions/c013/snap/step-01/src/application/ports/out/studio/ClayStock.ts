import type { ClayBag } from '../../../../domain/model/studio/ClayBag';

export interface ClayStock {
  load(clayBody: string): Promise<ClayBag | null>;
  store(bag: ClayBag): Promise<void>;
}
