import { SchedulePilotagePort } from '../../../application/ports/in/schedule-pilotage.port';
import { SchedulePilotageParamsDto, SchedulePilotageResponseDto } from './pilotage.dto';

export class PilotageController {
  constructor(private readonly schedulePilotage: SchedulePilotagePort) {}

  async postSchedule(params: SchedulePilotageParamsDto): Promise<SchedulePilotageResponseDto> {
    const result = await this.schedulePilotage.schedule({ jobId: params.jobId, notes: params.notes });
    return { jobId: result.jobId, status: result.status, fee: result.feeAmount === null ? null : `EUR ${result.feeAmount}` };
  }
}
