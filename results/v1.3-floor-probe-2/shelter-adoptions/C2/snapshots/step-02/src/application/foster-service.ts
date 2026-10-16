import { DomainError } from '../domain/animal';
import { assertCanHost, FosterCarer, Placement } from '../domain/foster';
import { FosterUseCases, SignUpCarerInput } from '../ports/in/foster';
import { AnimalRepository, CarerRepository, PlacementRepository } from '../ports/out/repositories';
import { Mailer } from '../ports/out/mailer';
import { Clock, IdGenerator } from '../ports/out/clock';
import { NotFoundError } from './shelter-service';

export class FosterService implements FosterUseCases {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly carers: CarerRepository,
    private readonly placements: PlacementRepository,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  signUp(input: SignUpCarerInput): FosterCarer {
    if (!(input.capacity > 0)) throw new DomainError('capacity must be positive');
    const c: FosterCarer = { id: this.ids.next('car'), ...input };
    this.carers.save(c);
    return c;
  }

  listCarers(): FosterCarer[] { return this.carers.list(); }

  place(animalId: string, carerId: string): Placement {
    const animal = this.animals.get(animalId);
    if (!animal) throw new NotFoundError(`animal ${animalId} not found`);
    if (animal.status === 'adopted') throw new DomainError('animal already adopted');
    if (this.placements.activeForAnimal(animalId)) throw new DomainError('animal already in foster care');
    const carer = this.carer(carerId);
    assertCanHost(carer, animal.species, this.placements.activeForCarer(carerId).length);
    const p: Placement = { id: this.ids.next('plc'), animalId, carerId, startedAt: this.clock.now() };
    this.placements.save(p);
    return p;
  }

  endPlacement(placementId: string): Placement {
    const p = this.placements.get(placementId);
    if (!p) throw new NotFoundError(`placement ${placementId} not found`);
    if (p.endedAt) throw new DomainError('placement already ended');
    const ended = { ...p, endedAt: this.clock.now() };
    this.placements.save(ended);
    return ended;
  }

  /** Called when the animal is adopted: ends its placement and tells the carer. */
  endForAdoption(animalId: string, animalName: string): void {
    const p = this.placements.activeForAnimal(animalId);
    if (!p) return;
    this.endPlacement(p.id);
    const carer = this.carer(p.carerId);
    this.mailer.send(carer.email, `${animalName} has been adopted`,
      `Dear ${carer.name}, ${animalName} has been adopted. Thank you for fostering! The placement has ended.`);
  }

  private carer(id: string): FosterCarer {
    const c = this.carers.get(id);
    if (!c) throw new NotFoundError(`carer ${id} not found`);
    return c;
  }
}
