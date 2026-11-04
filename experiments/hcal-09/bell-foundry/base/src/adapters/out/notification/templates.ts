export const statusLine = (commissionId: string, status: string): string =>
  `Your bell (commission ${commissionId}) is now ${status.toLowerCase().replace('_', ' ')}.`;

export const refusedMetalText = 'The bronze for your bell was refused at the foundry gate; we have ordered a new heat.';
