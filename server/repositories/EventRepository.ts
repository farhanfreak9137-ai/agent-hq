import Database from 'better-sqlite3';

export interface EventEntity {
  id: string;
  type: string;
  timestamp: number;
  message: string;
  agent_id: string | null;
  task_id: string | null;
  mission_id: string | null;
  metadata: Record<string, unknown> | null;
}

export class EventRepository {
  constructor(private db: Database.Database) {}

  public save(ev: EventEntity): EventEntity {
    this.db
      .prepare(`
        INSERT INTO events (id, type, timestamp, message, agent_id, task_id, mission_id, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        ev.id,
        ev.type,
        ev.timestamp || Date.now(),
        ev.message,
        ev.agent_id || null,
        ev.task_id || null,
        ev.mission_id || null,
        ev.metadata ? JSON.stringify(ev.metadata) : null
      );
    return ev;
  }

  public getRecent(limit: number = 50, filters?: { type?: string; missionId?: string }): EventEntity[] {
    let sql = 'SELECT * FROM events WHERE 1=1';
    const params: any[] = [];

    if (filters?.type) {
      sql += ' AND type LIKE ?';
      params.push(`%${filters.type}%`);
    }
    if (filters?.missionId) {
      sql += ' AND mission_id = ?';
      params.push(filters.missionId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapRow).reverse();
  }

  private mapRow(row: any): EventEntity {
    return {
      id: row.id,
      type: row.type,
      timestamp: Number(row.timestamp),
      message: row.message,
      agent_id: row.agent_id,
      task_id: row.task_id,
      mission_id: row.mission_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    };
  }
}
