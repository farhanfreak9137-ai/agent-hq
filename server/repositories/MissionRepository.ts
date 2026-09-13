import Database from 'better-sqlite3';

export interface MissionEntity {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  total_nodes: number;
  completed_nodes: number;
  summary: string | null;
  error: string | null;
  started_at: number | null;
  completed_at: number | null;
}

export class MissionRepository {
  constructor(private db: Database.Database) {}

  public getAll(): MissionEntity[] {
    const rows = this.db.prepare('SELECT * FROM missions ORDER BY started_at DESC').all() as any[];
    return rows.map(this.mapRow);
  }

  public getById(id: string): MissionEntity | null {
    const row = this.db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  public getLatestActive(): MissionEntity | null {
    const row = this.db
      .prepare("SELECT * FROM missions WHERE status IN ('pending', 'in_progress') ORDER BY started_at DESC LIMIT 1")
      .get() as any;
    return row ? this.mapRow(row) : null;
  }

  public create(mission: Omit<MissionEntity, 'completed_nodes'> & { completed_nodes?: number }): MissionEntity {
    this.db
      .prepare(`
        INSERT INTO missions (id, title, description, status, total_nodes, completed_nodes, summary, error, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        mission.id,
        mission.title,
        mission.description || null,
        mission.status || 'in_progress',
        mission.total_nodes || 0,
        mission.completed_nodes || 0,
        mission.summary || null,
        mission.error || null,
        mission.started_at || Date.now(),
        mission.completed_at || null
      );

    return {
      ...mission,
      completed_nodes: mission.completed_nodes || 0,
    };
  }

  public updateStatus(
    id: string,
    status: MissionEntity['status'],
    options?: { completed_nodes?: number; summary?: string; error?: string; completed_at?: number }
  ): void {
    let sql = 'UPDATE missions SET status = ?';
    const params: any[] = [status];

    if (options?.completed_nodes !== undefined) {
      sql += ', completed_nodes = ?';
      params.push(options.completed_nodes);
    }
    if (options?.summary !== undefined) {
      sql += ', summary = ?';
      params.push(options.summary);
    }
    if (options?.error !== undefined) {
      sql += ', error = ?';
      params.push(options.error);
    }
    if (options?.completed_at !== undefined) {
      sql += ', completed_at = ?';
      params.push(options.completed_at);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    this.db.prepare(sql).run(...params);
  }

  private mapRow(row: any): MissionEntity {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      total_nodes: Number(row.total_nodes || 0),
      completed_nodes: Number(row.completed_nodes || 0),
      summary: row.summary,
      error: row.error,
      started_at: row.started_at ? Number(row.started_at) : null,
      completed_at: row.completed_at ? Number(row.completed_at) : null,
    };
  }
}
