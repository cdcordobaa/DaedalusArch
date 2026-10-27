import { ClinicError } from './ClinicError';

/** Texts are refused for now because we sent too many; they may be tried again after the wait. */
export class TextingThrottled extends ClinicError {
  constructor(readonly waitMs: number) {
    super(`texting throttled, try again in ${String(waitMs)} ms`);
    this.name = 'TextingThrottled';
  }
}
