import type { CertificateVerifier, Skill } from "../domain/volunteer.js";

/** Routes each certificate check to the issuer responsible for the skill. */
export class SkillCertificateVerifier implements CertificateVerifier {
  constructor(
    private readonly bySkill: Partial<Record<Skill, CertificateVerifier>>,
    private readonly all: CertificateVerifier[],
  ) {}

  async isConfirmed(skill: Skill, certificateNumber: string): Promise<boolean> {
    const v = this.bySkill[skill];
    return v ? v.isConfirmed(skill, certificateNumber) : true;
  }

  async refresh(): Promise<void> {
    for (const v of this.all) await v.refresh?.();
  }
}
