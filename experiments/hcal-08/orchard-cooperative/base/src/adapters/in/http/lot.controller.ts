import { SendToPressPort } from '../../../application/ports/in/send-to-press.port';
import { SendToPressParamsDto, SendToPressResponseDto } from './lot.dto';

export class LotController {
  constructor(private readonly sendToPress: SendToPressPort) {}

  async postPress(params: SendToPressParamsDto): Promise<SendToPressResponseDto> {
    const result = await this.sendToPress.send({ lotId: params.lotId });
    return { lotId: result.lotId, status: result.status };
  }
}
