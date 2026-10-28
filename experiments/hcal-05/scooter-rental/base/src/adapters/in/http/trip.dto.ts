export interface StartTripRequestDto { riderId: string; scooterId: string }
export interface EndTripRequestDto { tripId: string; scooterId: string; batteryPercent: number; cardToken: string }
export interface EndTripResponseDto { result: string }
