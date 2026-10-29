import { ClinicError } from './ClinicError';

export class SlotTaken extends ClinicError {
  constructor() {
    super('the slot was taken');
    this.name = 'SlotTaken';
  }
}
