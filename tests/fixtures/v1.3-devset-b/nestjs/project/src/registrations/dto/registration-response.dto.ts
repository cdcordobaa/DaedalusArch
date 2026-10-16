import { Registration } from '../../domain/registration';

export class RegistrationResponseDto {
  id!: string;
  workshopId!: string;
  attendeeId!: string;
  active!: boolean;

  static from(registration: Registration): RegistrationResponseDto {
    return Object.assign(new RegistrationResponseDto(), {
      id: registration.id,
      workshopId: registration.workshopId,
      attendeeId: registration.attendeeId,
      active: registration.isActive,
    });
  }
}
