declare module "sql.js" {
  interface SqlJsStatic {
    (config?: { locateFile?: (file: string) => string }): Promise<{
      Database: new (data?: BufferSource) => SqlJsDatabase;
    }>;
  }
  export interface SqlJsDatabase {
    run(sql: string, params?: unknown[] | Record<string, unknown>): void;
    exec(sql: string, params?: unknown[]): unknown;
    export(): Uint8Array;
    close(): void;
    prepare(sql: string): SqlJsStatement;
  }
  export interface SqlJsStatement {
    bind(params?: unknown[] | Record<string, unknown>): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }
  const initSqlJs: SqlJsStatic;
  export default initSqlJs;
}
