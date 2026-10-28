import { ProductKind } from '../../../domain/case-order';
import { Invoice } from '../../../domain/invoice';

export interface SubmitCaseCommand {
  readonly caseId: string;
  readonly dentistId: string;
  readonly product: ProductKind;
  readonly teeth: readonly number[];
  readonly scanPayload: string;
}

export interface SubmitCaseResult {
  readonly caseId: string;
  readonly status: string;
  readonly invoice: Invoice | null;
}

export interface SubmitCasePort {
  submit(command: SubmitCaseCommand): Promise<SubmitCaseResult>;
}
