import { FosterCarer, FosterPlacement } from '../domain/foster';
import { InvalidOperation, NotFound } from '../domain/errors';
import { Fostering, NewCarer } from './ports/inbound';
import { AnimalStore, CarerStore, Clock, IdFactory, PlacementStore } from './ports/outbound';
import { NotificationService } from './notifications';

export class FosteringService implements Fostering {
  constructor(
    private readonly animals: AnimalStore,
    private readonly carerStore: CarerStore,
    private readonly placements: PlacementStore,
    private readonly notifications: NotificationService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
  ) {}

  signUp(input: NewCarer): FosterCarer {
    const c = new FosterCarer(this.ids.newId(), input.name, input.email, input.capacity, input.species, input.phone, input.notifyBy);
    this.carerStore.save(c);
    return c;
  }

  carers(): FosterCarer[] { return this.carerStore.all(); }

  place(animalId: string, carerId: string): FosterPlacement {
    const animal = this.animals.find(animalId);
    if (!animal) throw new NotFound(`animal ${animalId}`);
    if (animal.status === 'adopted') throw new InvalidOperation('adopted animals cannot be fostered');
    if (this.placements.activeFor({ animalId }).length > 0) throw new InvalidOperation('animal is already in foster care');
    const carer = this.carer(carerId);
    carer.checkCanTake(animal.species, this.placements.activeFor({ carerId }).length);
    const p = new FosterPlacement(this.ids.newId(), animalId, carerId, this.clock.nowIso());
    this.placements.save(p);
    return p;
  }

  endPlacement(placementId: string): FosterPlacement {
    const p = this.placements.find(placementId);
    if (!p) throw new NotFound(`placement ${placementId}`);
    p.end(this.clock.nowIso());
    this.placements.save(p);
    return p;
  }

  /** The animal was adopted: end its placement, if any, and e-mail the carer. */
  animalAdopted(animalId: string, animalName: string): void {
    for (const p of this.placements.activeFor({ animalId })) {
      this.endPlacement(p.id);
      const c = this.carer(p.carerId);
      void this.notifications.notify(c, `${animalName} found a home`, `Hi ${c.name}, ${animalName} has been adopted, so the foster placement has ended. Thank you!`);
    }
  }

  private carer(id: string): FosterCarer {
    const c = this.carerStore.find(id);
    if (!c) throw new NotFound(`carer ${id}`);
    return c;
  }
}
