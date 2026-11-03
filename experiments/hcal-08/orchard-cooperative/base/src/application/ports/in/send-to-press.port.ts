import { LotStatus } from '../../../domain/lot-status';

export interface SendToPressCommand {
  readonly lotId: string;
}

export interface SendToPressResult {
  readonly lotId: string;
  readonly status: LotStatus;
}

export interface SendToPressPort {
  send(command: SendToPressCommand): Promise<SendToPressResult>;
}
