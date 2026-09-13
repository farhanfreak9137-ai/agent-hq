import Database from 'better-sqlite3';

export interface AuditLogEntity {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  resource: string;
  resource_id: string | null;
  success: boolean;
  metadata: Record<string, unknown> | null;
  timestamp: number;
}

export class AuditRepository {
  constructor(private db: Database.Database) {}

  public record(entry: Omit<AuditLogEntity, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): AuditLogEntity {
    const id = entry.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const timestamp = entry.timestamp || Date.now();

    this.db
      .prepare(`
        INSERT INTO audit_logs (id, actor_id, actor_name, action, resource, resource_id, success, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        entry.actor_id,
        entry.actor_name,
        entry.action,
        entry.resource,
        entry.resource_id || null,
        entry.success ? 1 : 0,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        timestamp
      );

    return {
      id,
      actor_id: entry.actor_id,
      actor_name: entry.actor_name,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resource_id || null,
      success: Boolean(entry.success),
      metadata: entry.metadata || null,
      timestamp,
    };
  }

  public getRecent(limit: number = 50, filters?: { action?: string; actorId?: string }): AuditLogEntity[] {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (filters?.action) {
      sql += ' AND action LIKE ?';
      params.push(`%${filters.action}%`);
    }
    if (filters?.actorId) {
      sql += ' AND actor_id = ?';
      params.push(filters.actorId);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      actor_id: r.actor_id,
      actor_name: r.actor_name,
      action: r.action,
      resource: r.resource,
      resource_id: r.resource_id,
      success: Boolean(r.success),
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      timestamp: Number(r.timestamp),
    }));
  }
}
