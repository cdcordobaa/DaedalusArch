import { DataSource, Repository } from 'typeorm';
import { Reservation } from '../../../domain/model/Reservation';
import { ReservationRepository } from '../../../application/ports/out/ReservationRepository';
import { ReservationRecord } from './orm/ReservationRecord';

export class TypeOrmReservationRepository implements ReservationRepository {
  private readonly records: Repository<ReservationRecord>;

  constructor(dataSource: DataSource) {
    this.records = dataSource.getRepository(ReservationRecord);
  }

  async byId(id: string): Promise<Reservation | undefined> {
    const r = await this.records.findOne({ where: { id } });
    return r === null ? undefined : new Reservation(r.id, r.spotCode, r.plate, r.from, r.hours, r.cancelled);
  }

  async forSpot(spotCode: string): Promise<Reservation[]> {
    return (await this.records.find({ where: { spotCode } })).map((r) => new Reservation(r.id, r.spotCode, r.plate, r.from, r.hours, r.cancelled));
  }

  async save(reservation: Reservation): Promise<void> {
    await this.records.save(this.records.create({ ...reservation }));
  }
}
