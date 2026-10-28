export interface RoomDto {
  id: string;
  name: string;
  bookedHours: number;
  slots: Array<{ productionId: string; start: number; end: number }>;
}
