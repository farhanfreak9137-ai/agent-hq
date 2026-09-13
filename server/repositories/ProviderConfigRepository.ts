import Database from 'better-sqlite3';

export interface ProviderConfigEntity {
  id: string;
  name: string;
  is_enabled: boolean;
  timeout_ms: number;
  max_concurrency: number;
  models: string[];
  created_at: number;
  updated_at: number;
}

export class ProviderConfigRepository {
  constructor(private db: Database.Database) {}

  public getAll(): ProviderConfigEntity[] {
    const rows = this.db.prepare('SELECT * FROM provider_configs ORDER BY id ASC').all() as any[];
    return rows.map(this.mapRow);
  }

  public getById(id: string): ProviderConfigEntity | null {
    const row = this.db.prepare('SELECT * FROM provider_configs WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  public update(
    id: string,
    updates: Partial<Pick<ProviderConfigEntity, 'name' | 'is_enabled' | 'timeout_ms' | 'max_concurrency' | 'models'>>
  ): ProviderConfigEntity | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const isEnabled = updates.is_enabled !== undefined ? (updates.is_enabled ? 1 : 0) : existing.is_enabled ? 1 : 0;
    const timeoutMs = updates.timeout_ms !== undefined ? updates.timeout_ms : existing.timeout_ms;
    const maxConcurrency = updates.max_concurrency !== undefined ? updates.max_concurrency : existing.max_concurrency;
    const models = updates.models ? JSON.stringify(updates.models) : JSON.stringify(existing.models);
    const name = updates.name || existing.name;
    const now = Date.now();

    this.db
      .prepare(`
        UPDATE provider_configs
        SET name = ?, is_enabled = ?, timeout_ms = ?, max_concurrency = ?, models = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(name, isEnabled, timeoutMs, maxConcurrency, models, now, id);

    return this.getById(id);
  }

  private mapRow(row: any): ProviderConfigEntity {
    return {
      id: row.id,
      name: row.name,
      is_enabled: Boolean(row.is_enabled),
      timeout_ms: Number(row.timeout_ms),
      max_concurrency: Number(row.max_concurrency),
      models: JSON.parse(row.models || '[]'),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };
  }
}
