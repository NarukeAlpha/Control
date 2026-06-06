export type CacheProvider = "github" | "local-gateway" | (string & {});

export type CacheValidationState =
  | "not_loaded"
  | "cached"
  | "validating"
  | "validated"
  | "stale"
  | "refreshing"
  | "error"
  | "rate_limited"
  | "permission_denied";

export type CacheValidatorValue = string | number | boolean | null;

export interface CacheValidatorSnapshot {
  kind: string;
  version: number;
  values: Record<string, CacheValidatorValue>;
}

export interface CacheValidationMetadata {
  lastModified: string | null;
  validator: CacheValidatorSnapshot | null;
  validatedAt: string | null;
  validationState: CacheValidationState | null;
}

export interface CacheEnvelope<TPayload, TAvailability = unknown> extends CacheValidationMetadata {
  provider: CacheProvider;
  cacheKey: string;
  payload: TPayload;
  etag: string | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  availability?: TAvailability;
}
