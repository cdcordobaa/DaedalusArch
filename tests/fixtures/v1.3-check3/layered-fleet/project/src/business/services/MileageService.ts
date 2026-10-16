import { MileageTable } from '../../persistence/MileageTable';
import { SERVICE_INTERVAL_KM } from '../model/Vehicle';

export class MileageService {
  constructor(private readonly mileage: MileageTable) {}

  async record(plate: string, km: number, lastServiceKm: number): Promise<boolean> {
    await this.mileage.insert({ id: `${plate}@${km}`, plate, km, readAt: new Date() });
    return km - lastServiceKm >= SERVICE_INTERVAL_KM;
  }

  async averageDaily(plate: string): Promise<number> {
    const readings = (await this.mileage.rows(plate)).sort((a, b) => a.readAt.getTime() - b.readAt.getTime());
    const first = readings[0];
    const last = readings[readings.length - 1];
    if (first === undefined || last === undefined || first === last) return 0;
    const days = (last.readAt.getTime() - first.readAt.getTime()) / 86_400_000;
    return days > 0 ? (last.km - first.km) / days : 0;
  }
}
