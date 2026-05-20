export class DatabaseError extends Error {
  readonly code = "DATABASE_ERROR";

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`SQLite operation failed: ${operation}`);
    this.name = "DatabaseError";
  }
}

export class SerializationError extends Error {
  readonly code = "SERIALIZATION_ERROR";

  constructor(
    readonly operation: string,
    readonly cause: unknown
  ) {
    super(`Storage serialization failed: ${operation}`);
    this.name = "SerializationError";
  }
}
