import { RecordInspectionPort } from '@apiary/application/ports/in/record-inspection.port';

export class InspectionController {
  constructor(private readonly recordInspection: RecordInspectionPort) {}

  async postInspection(params: { placementId: string; hiveTag: string; inspector: string }): Promise<{ recorded: boolean }> {
    await this.recordInspection.record({ placementId: params.placementId, hiveTag: params.hiveTag, inspector: params.inspector });
    return { recorded: true };
  }
}
