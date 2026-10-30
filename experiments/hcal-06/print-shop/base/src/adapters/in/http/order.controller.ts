import { SendToPrintPort } from '../../../application/ports/in/send-to-print.port';
import { SendToPrintParamsDto, SendToPrintResponseDto } from './order.dto';

export class OrderController {
  constructor(private readonly sendToPrint: SendToPrintPort) {}

  async postPrint(params: SendToPrintParamsDto): Promise<SendToPrintResponseDto> {
    const result = await this.sendToPrint.send({ orderId: params.orderId });
    return { orderId: result.orderId, status: result.status, artworkProblems: [...result.issues] };
  }
}
