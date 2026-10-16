export interface Pupil {
  id: string;
  name: string;
  school: string;
  parentEmail: string;
  morningStopId: string;
  afternoonStopId: string;
  /** Number of the pupil's CardTap card, if they have one. */
  cardNumber?: string;
  /** How the parent wants boarding messages; defaults to e-mail. */
  notificationChannel: NotificationChannel;
  /** PingPost device token, required for the push channel. */
  pushDeviceToken?: string;
}

export type NotificationChannel = "email" | "push";

export type Trip = "morning" | "afternoon";
