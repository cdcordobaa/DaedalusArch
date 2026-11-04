export interface TelemetryFrameDto {
  hive_tag: string;
  yard_code: string;
  colony_state: import('hivepulse-sdk').ColonyState;
  brood_temp_c: number;
  weight_kg: number;
  firmware: string;
  timestamp: string;
}
