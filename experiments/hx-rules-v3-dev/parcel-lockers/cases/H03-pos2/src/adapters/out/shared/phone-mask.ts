import { LockboxDoorGateway } from '../lockers/lockbox-door.gateway';

export const DOOR_GATEWAY_NAME = LockboxDoorGateway.name;

export function maskPhone(phone: string): string {
  return phone.length <= 4 ? '****' : `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}
