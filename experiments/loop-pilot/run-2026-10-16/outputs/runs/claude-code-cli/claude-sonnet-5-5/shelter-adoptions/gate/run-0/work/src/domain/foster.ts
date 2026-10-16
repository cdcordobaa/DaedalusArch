import { ConflictError } from "./errors.js";
import type { NotificationChannel } from "./notification.js";

export interface FosterCarer {
  id: string;
  name: string;
  email: string;
  phone: string;
  notificationChannel?: NotificationChannel;
  capacity: number;
  species: string[];
  registeredAt: string;
}

export interface Placement {
  id: string;
  animalId: string;
  carerId: string;
  startedAt: string;
  endedAt?: string;
}

export function normalizeSpecies(species: string): string {
  return species.trim().toLowerCase();
}

export function canHost(carer: FosterCarer, species: string): boolean {
  return carer.species.includes(normalizeSpecies(species));
}

export function endPlacement(placement: Placement, at: string): Placement {
  if (placement.endedAt) {
    throw new ConflictError("Placement has already ended");
  }
  return { ...placement, endedAt: at };
}
