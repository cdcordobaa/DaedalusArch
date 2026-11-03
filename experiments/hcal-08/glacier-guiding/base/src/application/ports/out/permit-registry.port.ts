import { PermitClearance } from '../../../domain/permit';

export interface PermitApplication {
  readonly routeCode: string;
  readonly partySize: number;
  readonly ascentDate: string;
  readonly guideLicence: string;
}

export interface PermitRegistryPort {
  apply(application: PermitApplication): Promise<PermitClearance>;
}
