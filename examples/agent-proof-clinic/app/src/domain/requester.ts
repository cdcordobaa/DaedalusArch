/** Who is asking for a change: clinic staff, or a specific patient. */
export type Requester = { kind: "staff" } | { kind: "patient"; patientId: string };
