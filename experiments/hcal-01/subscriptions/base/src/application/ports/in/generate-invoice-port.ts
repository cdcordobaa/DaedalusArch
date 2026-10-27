import { Invoice } from '../../../domain/invoice';

export interface GenerateInvoiceCommand {
  readonly subscriptionId: string;
}

export interface GenerateInvoicePort {
  execute(command: GenerateInvoiceCommand): Promise<Invoice>;
}
