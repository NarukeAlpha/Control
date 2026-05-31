import { DatabaseError } from "./errors";

type Database = import("better-sqlite3").Database;

export type SqliteDatabase = Pick<Database, "exec" | "pragma" | "prepare" | "transaction" | "close">;

export interface DatabaseConnection {
  exec(source: string): void;
  pragma(source: string): unknown;
  run(source: string, ...params: unknown[]): void;
  get<Row>(source: string, ...params: unknown[]): Row | undefined;
  all<Row>(source: string, ...params: unknown[]): Row[];
}

export interface StorageDatabase extends DatabaseConnection {
  operation<T>(operation: string, action: () => T): T;
  transaction<T>(operation: string, action: (db: DatabaseConnection) => T): T;
  close(): void;
}

export function createStorageDatabaseAdapter(db: SqliteDatabase): StorageDatabase {
  return new BetterSqliteStorageDatabase(db);
}

export function runDatabaseOperation<T>(operation: string, action: () => T): T {
  try {
    return action();
  } catch (cause) {
    if (cause instanceof DatabaseError) {
      throw cause;
    }
    throw new DatabaseError(operation, cause);
  }
}

class BetterSqliteStorageDatabase implements StorageDatabase {
  private readonly operations: string[] = [];

  constructor(private readonly db: SqliteDatabase) {}

  operation<T>(operation: string, action: () => T): T {
    this.operations.push(operation);
    try {
      return runDatabaseOperation(operation, action);
    } finally {
      this.operations.pop();
    }
  }

  transaction<T>(operation: string, action: (db: DatabaseConnection) => T): T {
    return this.operation(operation, () => this.db.transaction(() => action(this))());
  }

  exec(source: string): void {
    this.runAdapterOperation("database.exec", () => {
      this.db.exec(source);
    });
  }

  pragma(source: string): unknown {
    return this.runAdapterOperation("database.pragma", () => this.db.pragma(source));
  }

  run(source: string, ...params: unknown[]): void {
    this.runAdapterOperation("database.run", () => {
      this.db.prepare<unknown[]>(source).run(...params);
    });
  }

  get<Row>(source: string, ...params: unknown[]): Row | undefined {
    return this.runAdapterOperation("database.get", () =>
      this.db.prepare<unknown[], Row>(source).get(...params)
    );
  }

  all<Row>(source: string, ...params: unknown[]): Row[] {
    return this.runAdapterOperation("database.all", () =>
      this.db.prepare<unknown[], Row>(source).all(...params)
    );
  }

  close(): void {
    runDatabaseOperation("database.close", () => {
      this.db.close();
    });
  }

  private runAdapterOperation<T>(fallbackOperation: string, action: () => T): T {
    return runDatabaseOperation(this.operations.at(-1) ?? fallbackOperation, action);
  }
}
