import type { WetShelf } from '../../../../domain/model/studio/WetShelf';

export interface WetShelves {
  list(): Promise<readonly WetShelf[]>;
  set(shelf: WetShelf): Promise<void>;
}
