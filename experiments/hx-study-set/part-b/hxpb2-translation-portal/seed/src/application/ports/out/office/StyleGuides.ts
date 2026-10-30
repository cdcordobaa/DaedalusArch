import type { StyleGuide } from '../../../../domain/model/office/StyleGuide';

export interface StyleGuides {
  of(clientId: string): Promise<StyleGuide | null>;
  save(guide: StyleGuide): Promise<void>;
}
