import { Volunteer } from "./volunteer";

export interface VolunteerRepository {
  save(v: Volunteer): void;
  findById(id: string): Volunteer | undefined;
  findAll(): Volunteer[];
}

/** Asks the issuer whether a certificate is confirmed. Unconfirmed or unreachable means false. */
export interface CertificateVerifier {
  isConfirmed(certificateNumber: string): Promise<boolean>;
}

/** National heavy-machinery licence registry: a daily-published list of valid licence numbers. */
export interface LicenceRegistry {
  /** Downloads the latest published list. Keeps the previous list if the download fails. */
  refresh(): Promise<void>;
  /** True only while the number is in the latest list. Never loaded means false. */
  isListed(licenceNumber: string): Promise<boolean>;
}
