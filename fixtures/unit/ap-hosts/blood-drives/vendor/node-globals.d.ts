// The two Node globals the composition root reads (no @types/node install).
declare const process: { readonly env: Record<string, string | undefined> };
