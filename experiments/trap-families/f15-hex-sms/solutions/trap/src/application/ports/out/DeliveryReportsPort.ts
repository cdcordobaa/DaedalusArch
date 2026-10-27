import type { TextwaveDeliveryReport } from 'textwave-sdk';

export interface DeliveryReportsPort {
  reportFor(messageSid: string): Promise<TextwaveDeliveryReport>;
}
