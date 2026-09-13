import Database from 'better-sqlite3';

export interface MemoryEntity {
  id: string;
  agent_id: string;
  task_id: string | null;
  session_id: string | null;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  timestamp: number;
  expires_at: number | null;
}

export class MemoryRepository {
  constructor(private db: Database.Database) {}

  public save(entry: MemoryEntity, maxRetention: number = 100): MemoryEntity {
    this.db
      .prepare(`
        INSERT INTO memory_entries (id, agent_id, task_id, session_id, type, content, metadata, timestamp, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.agent_id,
        entry.task_id || null,
        entry.session_id || null,
        entry.type,
        entry.content,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.timestamp || Date.now(),
        entry.expires_at || null
      );

    // Enforce retention limit per agent
    this.pruneAgentMemory(entry.agent_id, maxRetention);

    return entry;
  }

  public getRecentByAgent(agentId: string, limit: number = 25): MemoryEntity[] {
    const now = Date.now();
    const rows = this.db
      .prepare(`
        SELECT * FROM memory_entries
        WHERE agent_id = ? AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(agentId, now, limit) as any[];

    return rows.map(this.mapRow);
  }

  public getByType(agentId: string, type: string, limit: number = 25): MemoryEntity[] {
    const now = Date.now();
    const rows = this.db
      .prepare(`
        SELECT * FROM memory_entries
        WHERE agent_id = ? AND type = ? AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(agentId, type, now, limit) as any[];

    return rows.map(this.mapRow);
  }

  public pruneAgentMemory(agentId: string, maxEntries: number = 100): number {
    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM memory_entries WHERE agent_id = ?')
      .get(agentId) as { count: number };

    if (countRow.count > maxEntries) {
      const deleteCount = countRow.count - maxEntries;
      return this.db
        .prepare(`
          DELETE FROM memory_entries
          WHERE id IN (
            SELECT id FROM memory_entries
            WHERE agent_id = ?
            ORDER BY timestamp ASC
            LIMIT ?
          )
        `)
        .run(agentId, deleteCount).changes;
    }
    return 0;
  }

  public deleteExpired(): number {
    const now = Date.now();
    return this.db.prepare('DELETE FROM memory_entries WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now)
      .changes;
  }

  public clear(agentId?: string): void {
    if (agentId) {
      this.db.prepare('DELETE FROM memory_entries WHERE agent_id = ?').run(agentId);
    } else {
      this.db.prepare('DELETE FROM memory_entries').run();
    }
  }

  private mapRow(row: any): MemoryEntity {
    return {
      id: row.id,
      agent_id: row.agent_id,
      task_id: row.task_id,
      session_id: row.session_id,
      type: row.type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      timestamp: Number(row.timestamp),
      expires_at: row.expires_at ? Number(row.expires_at) : null,
    };
  }
}
