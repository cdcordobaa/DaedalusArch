import type { CloakroomTag } from '../../../../domain/model/admin/CloakroomTag';

export interface CloakroomTagStore {
  add(item: CloakroomTag): Promise<void>;
  all(): Promise<CloakroomTag[]>;
}
