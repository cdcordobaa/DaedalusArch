/** Our own description of a signature envelope and its recipients. */
export interface SignatureParty {
  emailAddress: string;
  fullName: string;
  role: string;
  routingOrder: number;
}

export interface EnvelopeDraft {
  emailSubject: string;
  documents: { fileName: string; documentBase64: string }[];
  recipients: SignatureParty[];
  expiresInDays: number;
}

export interface SentEnvelope {
  envelopeId: string;
  sentDateTime: string;
  recipients: (SignatureParty & { recipientStatus: string })[];
}

export interface SignaturePort {
  createEnvelope(draft: EnvelopeDraft): Promise<SentEnvelope>;
  getEnvelope(envelopeId: string): Promise<SentEnvelope>;
  sendReminder(envelopeId: string, request: { recipientEmails: string[] }): Promise<unknown>;
}
