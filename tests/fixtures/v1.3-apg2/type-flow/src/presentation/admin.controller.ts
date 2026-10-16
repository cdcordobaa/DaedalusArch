import { UserRecord } from '../infrastructure/user.record';

// TF5: explicit annotation. The v1.3 graph has the IMPORTS edge (presentation -> infrastructure, an allowed
// direction), but no v1.3 rule says what the imported name is used for.
export class AdminController {
  dump(): UserRecord[] {
    return [];
  }
}
