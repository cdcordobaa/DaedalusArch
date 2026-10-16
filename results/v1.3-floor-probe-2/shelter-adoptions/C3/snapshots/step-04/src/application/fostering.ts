import { Carer, Carers, Placement, ShelterError } from '../domain/model';
import { AnimalRepository, CarerRepository, PlacementRepository } from '../domain/ports/repositories';
import { Clock, Ids } from './ports';
import { Notifier } from './notifier';
import { Audit } from './audit';

export interface CarerInput { name: string; email: string; phone?: string; channel?: 'email' | 'sms'; capacity: number; species: string[] }

export class Fostering {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly carers: CarerRepository,
    private readonly placements: PlacementRepository,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly ids: Ids,
    private readonly audit: Audit,
  ) {}

  signUp(i: CarerInput): Carer {
    if (!(Number.isInteger(i.capacity) && i.capacity > 0)) throw new ShelterError('capacity must be a positive whole number', 'invalid');
    const c: Carer = { id: this.ids.next(), name: i.name, email: i.email, phone: i.phone, channel: i.channel, capacity: i.capacity, species: [...i.species] };
    this.carers.put(c);
    return c;
  }

  listCarers(): Carer[] { return this.carers.all(); }

  place(animalId: string, carerId: string, by: string): Placement {
    const animal = this.animals.get(animalId);
    if (!animal) throw new ShelterError(`animal ${animalId} not found`, 'not-found');
    if (animal.state === 'adopted') throw new ShelterError('animal already adopted');
    const current = this.placements.current();
    if (current.some((p) => p.animalId === animalId)) throw new ShelterError('animal is already placed');
    const carer = this.carer(carerId);
    Carers.assertRoomFor(carer, animal.species, current.filter((p) => p.carerId === carerId).length);
    const p: Placement = { id: this.ids.next(), animalId, carerId, from: this.clock.now() };
    return this.audit.saved(by, 'placement', p.id, animalId, null, p, (x) => this.placements.put(x));
  }

  end(placementId: string, by: string): Placement {
    const p = this.placements.get(placementId);
    if (!p) throw new ShelterError(`placement ${placementId} not found`, 'not-found');
    if (p.until) throw new ShelterError('placement already ended');
    return this.audit.saved(by, 'placement', p.id, p.animalId, p, { ...p, until: this.clock.now() }, (x) => this.placements.put(x));
  }

  /** Adoption approved: end the animal's placement and e-mail its carer. */
  onAdopted(animalId: string, animalName: string, by: string): void {
    const p = this.placements.current().find((x) => x.animalId === animalId);
    if (!p) return;
    this.end(p.id, by);
    const c = this.carer(p.carerId);
    void this.notifier.notify(c, `${animalName} was adopted`, `Hi ${c.name}, ${animalName} has been adopted, so your foster placement has ended. Thank you!`);
  }

  private carer(id: string): Carer {
    const c = this.carers.get(id);
    if (!c) throw new ShelterError(`carer ${id} not found`, 'not-found');
    return c;
  }
}
