import Database from 'better-sqlite3';

export interface AgentEntity {
  id: string;
  name: string;
  role: string;
  system_directive: string;
  provider_id: string;
  status: string;
  capabilities: string[];
  assigned_tools: string[];
  current_room_id: string;
  position_x: number;
  position_y: number;
  stats: Record<string, number>;
  created_at: number;
  updated_at: number;
}

export class AgentRepository {
  constructor(private db: Database.Database) {}

  public getAll(): AgentEntity[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY id ASC').all() as any[];
    return rows.map(this.mapRowToEntity);
  }

  public getById(id: string): AgentEntity | null {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    return row ? this.mapRowToEntity(row) : null;
  }

  public upsert(agent: Omit<AgentEntity, 'created_at' | 'updated_at'>): AgentEntity {
    const now = Date.now();
    const existing = this.getById(agent.id);

    if (existing) {
      this.db
        .prepare(`
          UPDATE agents
          SET name = ?, role = ?, system_directive = ?, provider_id = ?, status = ?,
              capabilities = ?, assigned_tools = ?, current_room_id = ?, position_x = ?,
              position_y = ?, stats = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(
          agent.name,
          agent.role,
          agent.system_directive,
          agent.provider_id,
          agent.status,
          JSON.stringify(agent.capabilities),
          JSON.stringify(agent.assigned_tools),
          agent.current_room_id,
          agent.position_x,
          agent.position_y,
          JSON.stringify(agent.stats),
          now,
          agent.id
        );
      return { ...agent, created_at: existing.created_at, updated_at: now };
    } else {
      this.db
        .prepare(`
          INSERT INTO agents (id, name, role, system_directive, provider_id, status, capabilities, assigned_tools, current_room_id, position_x, position_y, stats, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          agent.id,
          agent.name,
          agent.role,
          agent.system_directive,
          agent.provider_id,
          agent.status,
          JSON.stringify(agent.capabilities),
          JSON.stringify(agent.assigned_tools),
          agent.current_room_id,
          agent.position_x,
          agent.position_y,
          JSON.stringify(agent.stats),
          now,
          now
        );
      return { ...agent, created_at: now, updated_at: now };
    }
  }

  public updateStatus(id: string, status: string): void {
    this.db.prepare('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id);
  }

  public updatePosition(id: string, x: number, y: number, roomId?: string): void {
    if (roomId) {
      this.db
        .prepare('UPDATE agents SET position_x = ?, position_y = ?, current_room_id = ?, updated_at = ? WHERE id = ?')
        .run(x, y, roomId, Date.now(), id);
    } else {
      this.db
        .prepare('UPDATE agents SET position_x = ?, position_y = ?, updated_at = ? WHERE id = ?')
        .run(x, y, Date.now(), id);
    }
  }

  private mapRowToEntity(row: any): AgentEntity {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      system_directive: row.system_directive,
      provider_id: row.provider_id,
      status: row.status,
      capabilities: JSON.parse(row.capabilities || '[]'),
      assigned_tools: JSON.parse(row.assigned_tools || '[]'),
      current_room_id: row.current_room_id,
      position_x: Number(row.position_x),
      position_y: Number(row.position_y),
      stats: JSON.parse(row.stats || '{}'),
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
    };
  }
}
