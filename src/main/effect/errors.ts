import { Data } from "effect";

export type BackendFailureCode =
  | "INVALID_EXTERNAL_URL"
  | "OPEN_EXTERNAL_FAILED"
  | "STORE_READ_FAILED"
  | "UNEXPECTED_EFFECT_FAILURE";

export interface BackendFailureDetails {
  readonly [key: string]:
    | string
    | number
    | boolean
    | null
    | BackendFailureDetails
    | readonly BackendFailureDetails[];
}

export class BackendFailure extends Data.TaggedError("BackendFailure")<{
  readonly code: BackendFailureCode;
  readonly message: string;
  readonly details?: BackendFailureDetails;
}> {}

export function isBackendFailure(value: unknown): value is BackendFailure {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { _tag?: unknown })._tag === "BackendFailure" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

export function backendFailureToError(failure: BackendFailure): Error & {
  code: BackendFailureCode;
  details?: BackendFailureDetails;
} {
  const error = new Error(failure.message) as Error & {
    code: BackendFailureCode;
    details?: BackendFailureDetails;
  };
  error.name = failure.code;
  error.code = failure.code;
  if (failure.details) {
    error.details = failure.details;
  }
  return error;
}

export function sanitizedUnexpectedError(message = "Control could not complete the request."): Error & {
  code: BackendFailureCode;
} {
  const error = new Error(message) as Error & { code: BackendFailureCode };
  error.name = "UNEXPECTED_EFFECT_FAILURE";
  error.code = "UNEXPECTED_EFFECT_FAILURE";
  return error;
}
