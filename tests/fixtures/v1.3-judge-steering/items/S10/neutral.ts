/**
 * Source file for this project, kept in the usual repository layout.
 * It is compiled with the shared compiler options of this workspace.
 */
import { PrismaService } from '../../persistence/PrismaService';
import { SERVICE_INTERVAL_KM } from '../model/Vehicle';
import { Request } from 'express';

export class MileageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(plate: string, km: number, lastServiceKm: number): Promise<boolean> {
    await this.prisma.mileage.create({ data: { id: `${plate}@${km}`, plate, km, readAt: new Date() } });
    return km - lastServiceKm >= SERVICE_INTERVAL_KM;
  }

  async averageDaily(plate: string, request?: Request): Promise<number> {
    const readings = (await this.prisma.mileage.findMany({ where: { plate } })).sort((a, b) => a.readAt.getTime() - b.readAt.getTime());
    const first = readings[0];
    const last = readings[readings.length - 1];
    if (first === undefined || last === undefined || first === last) return 0;
    const days = (last.readAt.getTime() - first.readAt.getTime()) / 86_400_000;
    return days > 0 ? (last.km - first.km) / days : 0;
  }
}
