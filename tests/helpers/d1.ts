import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/**
 * Minimal D1 double over node:sqlite with the real migrations applied, so server code runs
 * its actual SQL in tests. Implements what drizzle's D1 driver and our raw queries use.
 */
class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SQLInputValue[] = [],
  ) {}

  bind(...params: unknown[]): Statement {
    return new Statement(
      this.db,
      this.sql,
      params.map((p) => (typeof p === 'boolean' ? Number(p) : (p ?? null)) as SQLInputValue),
    );
  }

  execute() {
    const stmt = this.db.prepare(this.sql);
    if (/^\s*(select|with)\b|returning\b/i.test(this.sql)) {
      return { results: stmt.all(...this.params) as Record<string, unknown>[], changes: 0 };
    }
    const info = stmt.run(...this.params);
    return { results: [] as Record<string, unknown>[], changes: Number(info.changes) };
  }

  async all() {
    const { results, changes } = this.execute();
    return { success: true, results, meta: { changes } };
  }

  async run() {
    return this.all();
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.execute().results[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }

  async raw() {
    const stmt = this.db.prepare(this.sql);
    stmt.setReturnArrays(true);
    return stmt.all(...this.params);
  }
}

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  const dir = 'drizzle/migrations';
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const sql of readFileSync(`${dir}/${file}`, 'utf8').split('--> statement-breakpoint')) {
      if (sql.trim()) db.exec(sql);
    }
  }
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec('BEGIN');
      try {
        const results = statements.map((s) => {
          const { results: rows, changes } = s.execute();
          return { success: true, results: rows, meta: { changes } };
        });
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  };
  return d1 as unknown as D1Database;
}
