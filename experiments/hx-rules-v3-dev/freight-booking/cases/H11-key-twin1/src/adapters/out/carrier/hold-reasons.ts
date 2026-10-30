import { HoldCode } from 'cargolink-sdk';
import { HoldReason } from '../../../domain/errors';

export const HOLD_REASON: Readonly<Record<HoldCode, HoldReason>> = {
  H10: 'lane-closed',
  H22: 'over-limit',
  H31: 'papers-missing',
  H47: 'manual-review',
};
