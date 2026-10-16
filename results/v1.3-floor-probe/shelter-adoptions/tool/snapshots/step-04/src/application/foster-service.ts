import { FosterCarer, Placement, canHost } from '../domain/foster';
import { AnimalRepository, CarerRepository, IdGenerator, PlacementRepository, UnitOfWork } from './ports';
import { AuditService } from './audit-service';
import { NotFoundError } from './animal-service';

export interface SignUpCarerInput {
  name: string;
  email: string;
  capacity: number;
  species: string[];
}

export class FosterService {
  constructor(
    private readonly carers: CarerRepository,
    private readonly placements: PlacementRepository,
    private readonly animals: AnimalRepository,
    private readonly ids: IdGenerator,
    private readonly audit: AuditService,
    private readonly uow: UnitOfWork,
    private readonly now: () => Date = () => new Date(),
  ) {}

  signUp(input: SignUpCarerInput): FosterCarer {
    if (!input.name || !input.email) throw new Error('name and email are required');
    if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new Error('capacity must be a positive integer');
    const carer: FosterCarer = { id: this.ids.next(), ...input, species: input.species ?? [] };
    this.carers.save(carer);
    return carer;
  }

  listCarers(): FosterCarer[] {
    return this.carers.findAll();
  }

  place(actor: string, animalId: string, carerId: string): Placement {
    const animal = this.animals.findById(animalId);
    if (!animal) throw new NotFoundError(`Animal ${animalId} not found`);
    if (animal.status === 'adopted') throw new Error('Animal is already adopted');
    const carer = this.carers.findById(carerId);
    if (!carer) throw new NotFoundError(`Carer ${carerId} not found`);
    if (this.placements.findActiveByAnimal(animalId)) throw new Error('Animal is already in foster care');
    const active = this.placements.findActiveByCarer(carerId).length;
    if (!canHost(carer, animal.species, active)) throw new Error('Carer cannot host this animal (capacity or species)');
    const placement: Placement = { id: this.ids.next(), animalId, carerId, startedAt: this.now().toISOString() };
    return this.uow.run(() => {
      this.placements.save(placement);
      this.audit.record(actor, 'placement', placement.id, animalId, null, placement);
      return placement;
    });
  }

  endPlacement(actor: string, placementId: string): Placement {
    const placement = this.placements.findById(placementId);
    if (!placement) throw new NotFoundError(`Placement ${placementId} not found`);
    if (placement.endedAt) throw new Error('Placement already ended');
    const ended = { ...placement, endedAt: this.now().toISOString() };
    return this.uow.run(() => {
      this.placements.save(ended);
      this.audit.record(actor, 'placement', placement.id, placement.animalId, placement, ended);
      return ended;
    });
  }
}
