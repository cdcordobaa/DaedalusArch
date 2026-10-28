export type SurveyStatusLabel = 'draft' | 'booked' | 'completed' | 'cancelled';

export interface SurveyStatusView {
  id: string;
  status: SurveyStatusLabel;
}
