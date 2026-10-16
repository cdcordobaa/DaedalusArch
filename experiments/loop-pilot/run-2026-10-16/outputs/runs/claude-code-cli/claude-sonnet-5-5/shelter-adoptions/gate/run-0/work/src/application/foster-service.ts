import { canHost, endPlacement, normalizeSpecies, type FosterCarer, type Placement } from "../domain/foster.js";
import { parseChannel, type NotificationChannel } from "../domain/notification.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import type {
  AnimalRepository,
  ChangeStore,
  Clock,
  FosterCarerRepository,
  IdGenerator,
  PlacementRepository,
} from "./ports.js";

export interface RegisterCarerCommand {
  name: string;
  email: string;
  phone: string;
  notificationChannel?: NotificationChannel;
  capacity: number;
  species: string[];
}

export class FosterService {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly carers: FosterCarerRepository,
    private readonly placements: PlacementRepository,
    private readonly changes: ChangeStore,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async registerCarer(cmd: RegisterCarerCommand): Promise<FosterCarer> {
    if (!cmd.name.trim()) throw new ValidationError("name is required");
    if (!/^[^@\s]+@[^@\s]+$/.test(cmd.email)) throw new ValidationError("email is invalid");
    if (!cmd.phone.trim()) throw new ValidationError("phone is required");
    if (!Number.isInteger(cmd.capacity) || cmd.capacity < 1) {
      throw new ValidationError("capacity must be an integer >= 1");
    }
    const species = [...new Set(cmd.species.map(normalizeSpecies))];
    if (species.length === 0 || species.some((s) => !s)) {
      throw new ValidationError("species must be a non-empty list of species names");
    }
    const carer: FosterCarer = {
      id: this.ids.next(),
      name: cmd.name.trim(),
      email: cmd.email,
      phone: cmd.phone,
      notificationChannel: parseChannel(cmd.notificationChannel),
      capacity: cmd.capacity,
      species,
      registeredAt: this.clock.now().toISOString(),
    };
    await this.carers.save(carer);
    return carer;
  }

  async getCarer(id: string): Promise<FosterCarer> {
    const carer = await this.carers.findById(id);
    if (!carer) throw new NotFoundError(`Foster carer ${id} not found`);
    return carer;
  }

  listCarers(): Promise<FosterCarer[]> {
    return this.carers.findAll();
  }

  async listCarerPlacements(carerId: string): Promise<Placement[]> {
    await this.getCarer(carerId);
    return this.placements.findByCarerId(carerId);
  }

  async place(animalId: string, carerId: string, actor: string): Promise<Placement> {
    const animal = await this.animals.findById(animalId);
    if (!animal) throw new NotFoundError(`Animal ${animalId} not found`);
    const carer = await this.getCarer(carerId);
    if (animal.status === "adopted") throw new ConflictError("Animal has already been adopted");
    if (await this.placements.findActiveByAnimalId(animalId)) {
      throw new ConflictError("Animal is already in foster care");
    }
    if (!canHost(carer, animal.species)) {
      throw new ConflictError(`Carer does not host ${animal.species}`);
    }
    const placement: Placement = {
      id: this.ids.next(),
      animalId,
      carerId,
      startedAt: this.clock.now().toISOString(),
    };
    // The store rejects the commit with a ConflictError when the carer is at full capacity.
    await this.changes.commit([{ entityType: "placement", entity: placement, capacity: carer.capacity }], actor);
    return placement;
  }

  async get(id: string): Promise<Placement> {
    const placement = await this.placements.findById(id);
    if (!placement) throw new NotFoundError(`Placement ${id} not found`);
    return placement;
  }

  list(): Promise<Placement[]> {
    return this.placements.findAll();
  }

  async end(id: string, actor: string): Promise<Placement> {
    const ended = endPlacement(await this.get(id), this.clock.now().toISOString());
    await this.changes.commit([{ entityType: "placement", entity: ended }], actor);
    return ended;
  }
}
