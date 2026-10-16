import { Workshop } from './workshop';

export const WORKSHOP_REPOSITORY = 'WORKSHOP_REPOSITORY';

export interface WorkshopRepository {
  findById(id: string): Promise<Workshop | undefined>;
  findAll(): Promise<Workshop[]>;
  save(workshop: Workshop): Promise<void>;
}
