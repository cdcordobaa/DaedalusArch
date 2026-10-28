import type { Adoptions } from '../../../application/ports/in/Adoptions';
import type { Intake } from '../../../application/ports/in/Intake';
import { type HttpResponse, respond } from './HttpResponse';

/** POST /pets, POST /adopters, GET /pets/:id, POST /applications, POST /applications/:id/approve, GET /applications/:id. */
export class ShelterController {
  constructor(
    private readonly intake: Intake,
    private readonly adoptions: Adoptions,
  ) {}

  admitPet(name: string, species: string): HttpResponse {
    return respond(() => this.intake.admitPet(name, species));
  }

  registerAdopter(name: string): HttpResponse {
    return respond(() => this.intake.registerAdopter(name));
  }

  pet(id: string): HttpResponse {
    return respond(() => this.intake.pet(id));
  }

  apply(petId: string, adopterId: string): HttpResponse {
    return respond(() => this.adoptions.apply(petId, adopterId));
  }

  approve(applicationId: string): HttpResponse {
    return respond(() => this.adoptions.approve(applicationId));
  }

  withdrawApplication(applicationId: string): HttpResponse {
    return respond(() => this.adoptions.withdraw(applicationId));
  }

  application(id: string): HttpResponse {
    return respond(() => this.adoptions.application(id));
  }
}
