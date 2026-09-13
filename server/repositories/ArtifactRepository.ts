import Database from 'better-sqlite3';
import { Artifact } from '../../src/types/index.ts';

export class ArtifactRepository {
  constructor(private db: Database.Database) {}

  public create(artifact: Artifact): Artifact {
    const stmt = this.db.prepare(`
      INSERT INTO artifacts (id, task_id, agent_id, mission_id, type, title, content, created_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      artifact.id,
      artifact.taskId,
      artifact.agentId,
      artifact.missionId || null,
      artifact.type,
      artifact.title,
      artifact.content,
      artifact.createdAt,
      artifact.metadata ? JSON.stringify(artifact.metadata) : null
    );

    return artifact;
  }

  public findById(id: string): Artifact | null {
    const stmt = this.db.prepare(`SELECT * FROM artifacts WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByTaskId(taskId: string): Artifact[] {
    const stmt = this.db.prepare(`SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC`);
    const rows = stmt.all(taskId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public findByMissionId(missionId: string): Artifact[] {
    const stmt = this.db.prepare(`SELECT * FROM artifacts WHERE mission_id = ? ORDER BY created_at ASC`);
    const rows = stmt.all(missionId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public findAll(limit: number = 100): Artifact[] {
    const stmt = this.db.prepare(`SELECT * FROM artifacts ORDER BY created_at DESC LIMIT ?`);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: any): Artifact {
    return {
      id: row.id,
      taskId: row.task_id,
      agentId: row.agent_id,
      missionId: row.mission_id || undefined,
      type: row.type,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
