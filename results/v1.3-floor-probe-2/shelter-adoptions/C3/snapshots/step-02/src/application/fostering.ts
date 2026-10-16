import { Carer, Carers, Placement, ShelterError } from '../domain/model';
import { AnimalRepository, CarerRepository, PlacementRepository } from '../domain/ports/repositories';
import { Clock, Ids, MailProvider } from './ports';

export interface CarerInput { name: string; email: string; phone?: string; capacity: number; species: string[] }

export class Fostering {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly carers: CarerRepository,
    private readonly placements: PlacementRepository,
    private readonly mail: MailProvider,
    private readonly clock: Clock,
    private readonly ids: Ids,
  ) {}

  signUp(i: CarerInput): Carer {
    if (!(Number.isInteger(i.capacity) && i.capacity > 0)) throw new ShelterError('capacity must be a positive whole number', 'invalid');
    const c: Carer = { id: this.ids.next(), name: i.name, email: i.email, phone: i.phone, capacity: i.capacity, species: [...i.species] };
    this.carers.put(c);
    return c;
  }

  listCarers(): Carer[] { return this.carers.all(); }

  place(animalId: string, carerId: string): Placement {
    const animal = this.animals.get(animalId);
    if (!animal) throw new ShelterError(`animal ${animalId} not found`, 'not-found');
    if (animal.state === 'adopted') throw new ShelterError('animal already adopted');
    const current = this.placements.current();
    if (current.some((p) => p.animalId === animalId)) throw new ShelterError('animal is already placed');
    const carer = this.carer(carerId);
    Carers.assertRoomFor(carer, animal.species, current.filter((p) => p.carerId === carerId).length);
    const p: Placement = { id: this.ids.next(), animalId, carerId, from: this.clock.now() };
    this.placements.put(p);
    return p;
  }

  end(placementId: string): Placement {
    const p = this.placements.get(placementId);
    if (!p) throw new ShelterError(`placement ${placementId} not found`, 'not-found');
    if (p.until) throw new ShelterError('placement already ended');
    const ended = { ...p, until: this.clock.now() };
    this.placements.put(ended);
    return ended;
  }

  /** Adoption approved: end the animal's placement and e-mail its carer. */
  onAdopted(animalId: string, animalName: string): void {
    const p = this.placements.current().find((x) => x.animalId === animalId);
    if (!p) return;
    this.end(p.id);
    const c = this.carer(p.carerId);
    this.mail.send({ to: c.email, subject: `${animalName} was adopted`, body: `Hi ${c.name},\n\n${animalName} has been adopted, so your foster placement has ended. Thank you for caring for them.` });
  }

  private carer(id: string): Carer {
    const c = this.carers.get(id);
    if (!c) throw new ShelterError(`carer ${id} not found`, 'not-found');
    return c;
  }
}
