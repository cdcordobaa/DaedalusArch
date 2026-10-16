import { Workshop } from '../../domain/workshop';

export class WorkshopResponseDto {
  id!: string;
  title!: string;
  seatsLeft!: number;
  startsAt!: string;

  static from(workshop: Workshop): WorkshopResponseDto {
    return Object.assign(new WorkshopResponseDto(), {
      id: workshop.id,
      title: workshop.title,
      seatsLeft: workshop.seatsLeft,
      startsAt: workshop.startsAt.toISOString(),
    });
  }
}
