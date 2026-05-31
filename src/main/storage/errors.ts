export type StorageErrorKind = "io" | "migration" | "serialization" | "unavailable";

export class DatabaseError extends Error {
  readonly code = "STORAGE_IO_ERROR";
  readonly kind = "io" satisfies StorageErrorKind;

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`SQLite operation failed: ${operation}`);
    this.name = "DatabaseError";
  }
}

export class SerializationError extends Error {
  readonly code = "STORAGE_SERIALIZATION_ERROR";
  readonly kind = "serialization" satisfies StorageErrorKind;

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Storage serialization failed: ${operation}`);
    this.name = "SerializationError";
  }
}

export class MigrationError extends Error {
  readonly code = "STORAGE_MIGRATION_ERROR";
  readonly kind = "migration" satisfies StorageErrorKind;

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Storage migration failed: ${operation}`);
    this.name = "MigrationError";
  }
}

export class UnavailableDatabaseError extends Error {
  readonly code = "STORAGE_UNAVAILABLE";
  readonly kind = "unavailable" satisfies StorageErrorKind;

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Storage database unavailable: ${operation}`);
    this.name = "UnavailableDatabaseError";
  }
}
