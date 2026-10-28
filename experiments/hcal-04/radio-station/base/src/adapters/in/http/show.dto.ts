export interface ScheduleShowRequestDto {
  title: string;
  hostId: string;
  day: number;
  start: number;
  length: number;
}
export interface ScheduleShowResponseDto {
  id?: string;
  error?: string;
}
