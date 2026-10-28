import type { PermitService } from '../application/PermitService';
import type { PermitDto } from '../contracts/PermitDto';

export class PermitController {
  constructor(private readonly service: PermitService) {}

  submit(permitId: string): PermitDto {
    this.service.submitToAuthority(permitId);
    return this.service.getPermit(permitId);
  }

  get(permitId: string): PermitDto {
    return this.service.getPermit(permitId);
  }
}
