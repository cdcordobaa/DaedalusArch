let counter = 0;

/** Correlation id for log lines of one HTTP request. */
export const nextRequestId = (): string => `req-${Date.now().toString(36)}-${(counter++).toString(36)}`;
