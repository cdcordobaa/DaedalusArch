import type { SigningAllowance } from '../../../domain/model/SigningAllowance';

export interface AllowanceSource {
  current(): Promise<SigningAllowance>;
}
