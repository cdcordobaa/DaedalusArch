/** Records stored by the persistence layer. The business layer re-exports them. */
export interface Member {
  id: string;
  name: string;
  phone?: string;
}

export interface Apiary {
  id: string;
  name: string;
  region: string;
  ownerId: string;
}

export interface Hive {
  id: string;
  apiaryId: string;
  ownerId: string;
  label: string;
}

export interface Inspection {
  id: string;
  hiveId: string;
  date: string;
  queenSeen: boolean;
  broodFrames: number;
  temperament: number;
  varroaPer100: number;
  recordedBy: string;
}
