export const GARDEN_NAME = process.env.GARDEN_NAME ?? 'Greenfield Community Garden';

export interface EmailContent {
  subject: string;
  body: string;
}

/** The one e-mail layout every garden e-mail uses. */
export function layoutEmail(gardenerName: string, subject: string, paragraphs: string[]): EmailContent {
  return {
    subject: `[${GARDEN_NAME}] ${subject}`,
    body: [`Dear ${gardenerName},`, '', ...paragraphs, '', 'Happy gardening,', `The ${GARDEN_NAME} team`].join('\n'),
  };
}
