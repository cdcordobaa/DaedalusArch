export interface RoomDto {
  id: string;
  name: string;
  slots: Array<{ productionId: string; start: number; end: number }>;
}
