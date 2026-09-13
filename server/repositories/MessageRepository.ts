import Database from 'better-sqlite3';

export interface MessageEntity {
  id: string;
  source_agent_id: string;
  target_agent_id: string;
  content: string;
  type: string;
  task_id: string | null;
  timestamp: number;
  payload: Record<string, unknown> | null;
}

export class MessageRepository {
  constructor(private db: Database.Database) {}

  public save(msg: MessageEntity): MessageEntity {
    this.db
      .prepare(`
        INSERT INTO messages (id, source_agent_id, target_agent_id, content, type, task_id, timestamp, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        msg.id,
        msg.source_agent_id,
        msg.target_agent_id,
        msg.content,
        msg.type || 'chat',
        msg.task_id || null,
        msg.timestamp || Date.now(),
        msg.payload ? JSON.stringify(msg.payload) : null
      );

    return msg;
  }

  public getHistory(agentId?: string, limit: number = 50): MessageEntity[] {
    let sql = 'SELECT * FROM messages';
    const params: any[] = [];

    if (agentId) {
      sql += ' WHERE source_agent_id = ? OR target_agent_id = ?';
      params.push(agentId, agentId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.mapRow).reverse();
  }

  public getRecent(limit: number = 30): MessageEntity[] {
    const rows = this.db
      .prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map(this.mapRow).reverse();
  }

  private mapRow(row: any): MessageEntity {
    return {
      id: row.id,
      source_agent_id: row.source_agent_id,
      target_agent_id: row.target_agent_id,
      content: row.content,
      type: row.type,
      task_id: row.task_id,
      timestamp: Number(row.timestamp),
      payload: row.payload ? JSON.parse(row.payload) : null,
    };
  }
}
