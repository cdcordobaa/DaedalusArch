export class DeploymentError extends Error {
  constructor(
    message: string,
    readonly kind: "not_found" | "conflict" | "invalid" = "invalid",
  ) {
    super(message);
  }
}

export class Incident {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly region: string,
    readonly startDate: string,
  ) {}
}

/** The certification a volunteer held for the shift's skill when they were assigned. */
export interface CertificationSnapshot {
  number: string;
  expiry: string;
}

export class Shift {
  private readonly _volunteers: string[] = [];
  private readonly _certifications = new Map<string, CertificationSnapshot | null>();

  constructor(
    readonly id: string,
    readonly incidentId: string,
    readonly date: string, // YYYY-MM-DD
    readonly startTime: string, // HH:MM
    readonly hours: number,
    readonly requiredSkill: string,
    readonly peopleNeeded: number,
  ) {
    if (!Number.isInteger(peopleNeeded) || peopleNeeded < 1) throw new DeploymentError("peopleNeeded must be a positive integer");
    if (!(hours > 0 && hours <= 24)) throw new DeploymentError("hours must be between 0 and 24");
  }

  get volunteers(): readonly string[] {
    return this._volunteers;
  }

  /** Certification the volunteer's assignment relied on; null when the skill needs none. */
  certificationOf(volunteerId: string): CertificationSnapshot | null {
    return this._certifications.get(volunteerId) ?? null;
  }

  get startMs(): number {
    return Date.parse(`${this.date}T${this.startTime}:00Z`);
  }

  get endMs(): number {
    return this.startMs + this.hours * 3_600_000;
  }

  overlaps(other: Shift): boolean {
    return this.startMs < other.endMs && other.startMs < this.endMs;
  }

  isFull(): boolean {
    return this._volunteers.length >= this.peopleNeeded;
  }

  /** `others` are the volunteer's existing shifts. */
  assign(volunteerId: string, others: readonly Shift[], certification?: CertificationSnapshot): void {
    if (this._volunteers.includes(volunteerId)) throw new DeploymentError("Volunteer already assigned to this shift", "conflict");
    if (this.isFull()) throw new DeploymentError("Shift is already fully staffed", "conflict");
    if (others.some((o) => o.id !== this.id && o.overlaps(this))) {
      throw new DeploymentError("Volunteer is already on an overlapping shift", "conflict");
    }
    this._volunteers.push(volunteerId);
    this._certifications.set(volunteerId, certification ? { ...certification } : null);
  }

  unassign(volunteerId: string): void {
    const i = this._volunteers.indexOf(volunteerId);
    if (i < 0) throw new DeploymentError("Volunteer is not assigned to this shift", "not_found");
    this._volunteers.splice(i, 1);
    this._certifications.delete(volunteerId);
  }
}
