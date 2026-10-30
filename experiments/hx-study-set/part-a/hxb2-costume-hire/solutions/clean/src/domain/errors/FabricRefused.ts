import { WardrobeError } from './WardrobeError';

/** The cleaners will not take this fabric; it has to be cleaned by hand. */
export class FabricRefused extends WardrobeError {
  constructor() {
    super('the cleaners do not take this fabric');
    this.name = 'FabricRefused';
  }
}
