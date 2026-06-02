export type IpcJsonValue =
  | string
  | number
  | boolean
  | null
  | IpcJsonValue[]
  | { [key: string]: IpcJsonValue };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function requireRecord<TInput extends object = Record<string, unknown>>(
  value: unknown,
  message: string
): TInput {
  if (!isRecord(value)) {
    throw new Error(message);
  }

  return value as TInput;
}

export function requireTrimmedString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

export function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function nullableTrimmedString(value: unknown): string | null {
  return optionalTrimmedString(value) ?? null;
}

export function optionalString(value: unknown, message: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

export function optionalNullableString(value: unknown, message: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(message);
  }
  return value;
}

export function requirePositiveInteger(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(message);
  }
  return value;
}

export function optionalPositiveInteger(value: unknown, message: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requirePositiveInteger(value, message);
}

export function optionalBoolean(value: unknown, message: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

export function optionalNullableBoolean(value: unknown, message: string): boolean | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

export function requireStringArray(value: unknown, message: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(message);
  }

  return value.map((item) => requireTrimmedString(item, message));
}

export function isJsonObject(value: unknown): value is { [key: string]: IpcJsonValue } {
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

export function isJsonValue(value: unknown): value is IpcJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isJsonObject(value);
}

export function requireJsonValue(value: unknown, message: string): IpcJsonValue {
  if (!isJsonValue(value)) {
    throw new Error(message);
  }
  return value;
}

export function optionalJsonValue(value: unknown, message: string): IpcJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requireJsonValue(value, message);
}

export function optionalJsonArray(value: unknown, message: string): IpcJsonValue[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || !value.every(isJsonValue)) {
    throw new Error(message);
  }
  return value;
}

export function optionalJsonObject(
  value: unknown,
  message: string
): { [key: string]: IpcJsonValue } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isJsonObject(value)) {
    throw new Error(message);
  }
  return value;
}
