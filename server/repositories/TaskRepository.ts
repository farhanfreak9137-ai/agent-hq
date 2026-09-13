import Database from 'better-sqlite3';

export interface TaskEntity {
  id: string;
  mission_id: string | null;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED' | 'INTERRUPTED';
  assigned_agent_id: string | null;
  provider_id: string;
  execution_mode: 'real' | 'mock';
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown> | null;
  error: string | null;
  dependencies?: string[];
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface TaskExecutionEntity {
  id: string;
  task_id: string;
  agent_id: string;
  provider_id: string;
  execution_mode: string;
  attempt_number: number;
  status: 'running' | 'completed' | 'failed' | 'interrupted' | 'timed_out';
  started_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  summary: string | null;
  output: string | null;
  tools_used: string[];
  error: string | null;
}

export class TaskRepository {
  constructor(private db: Database.Database) {}

  public getAll(filters?: { missionId?: string; status?: string; agentId?: string }): TaskEntity[] {
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filters?.missionId) {
      sql += ' AND mission_id = ?';
      params.push(filters.missionId);
    }
    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.agentId) {
      sql += ' AND assigned_agent_id = ?';
      params.push(filters.agentId);
    }
    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRowToEntity(r));
  }

  public getById(id: string): TaskEntity | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return null;
    const task = this.mapRowToEntity(row);
    task.dependencies = this.getDependencies(id);
    return task;
  }

  public create(task: Omit<TaskEntity, 'created_at'>): TaskEntity {
    const now = Date.now();
    this.db
      .prepare(`
        INSERT INTO tasks (id, mission_id, title, description, priority, status, assigned_agent_id, provider_id, execution_mode, attempts, max_attempts, result, error, created_at, started_at, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        task.id,
        task.mission_id || null,
        task.title,
        task.description,
        task.priority || 'MEDIUM',
        task.status || 'PENDING',
        task.assigned_agent_id || null,
        task.provider_id || 'mock',
        task.execution_mode || 'mock',
        task.attempts || 0,
        task.max_attempts || 3,
        task.result ? JSON.stringify(task.result) : null,
        task.error || null,
        now,
        task.started_at || null,
        task.completed_at || null
      );

    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        this.addDependency(task.id, depId);
      }
    }

    return { ...task, created_at: now };
  }

  public updateStatus(
    id: string,
    status: TaskEntity['status'],
    options?: { error?: string; started_at?: number; completed_at?: number }
  ): void {
    let sql = 'UPDATE tasks SET status = ?';
    const params: any[] = [status];

    if (options?.error !== undefined) {
      sql += ', error = ?';
      params.push(options.error);
    }
    if (options?.started_at !== undefined) {
      sql += ', started_at = ?';
      params.push(options.started_at);
    }
    if (options?.completed_at !== undefined) {
      sql += ', completed_at = ?';
      params.push(options.completed_at);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    this.db.prepare(sql).run(...params);
  }

  public recordResult(
    id: string,
    result: Record<string, unknown>,
    executionMode: 'real' | 'mock' = 'mock'
  ): void {
    const now = Date.now();
    this.db
      .prepare(`
        UPDATE tasks
        SET status = 'COMPLETED', result = ?, execution_mode = ?, completed_at = ?
        WHERE id = ?
      `)
      .run(JSON.stringify(result), executionMode, now, id);
  }

  public addDependency(taskId: string, dependsOnTaskId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)')
      .run(taskId, dependsOnTaskId);
  }

  public getDependencies(taskId: string): string[] {
    const rows = this.db
      .prepare('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?')
      .all(taskId) as { depends_on_task_id: string }[];
    return rows.map((r) => r.depends_on_task_id);
  }

  public recordExecution(execution: TaskExecutionEntity): void {
    this.db
      .prepare(`
        INSERT INTO task_executions (id, task_id, agent_id, provider_id, execution_mode, attempt_number, status, started_at, completed_at, duration_ms, summary, output, tools_used, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        execution.id,
        execution.task_id,
        execution.agent_id,
        execution.provider_id,
        execution.execution_mode,
        execution.attempt_number,
        execution.status,
        execution.started_at,
        execution.completed_at,
        execution.duration_ms,
        execution.summary,
        execution.output,
        JSON.stringify(execution.tools_used || []),
        execution.error
      );
  }

  public getExecutions(taskId: string): TaskExecutionEntity[] {
    const rows = this.db
      .prepare('SELECT * FROM task_executions WHERE task_id = ? ORDER BY attempt_number ASC')
      .all(taskId) as any[];
    return rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      agent_id: r.agent_id,
      provider_id: r.provider_id,
      execution_mode: r.execution_mode,
      attempt_number: Number(r.attempt_number),
      status: r.status,
      started_at: Number(r.started_at),
      completed_at: r.completed_at ? Number(r.completed_at) : null,
      duration_ms: r.duration_ms ? Number(r.duration_ms) : null,
      summary: r.summary,
      output: r.output,
      tools_used: JSON.parse(r.tools_used || '[]'),
      error: r.error,
    }));
  }

  private mapRowToEntity(row: any): TaskEntity {
    return {
      id: row.id,
      mission_id: row.mission_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      assigned_agent_id: row.assigned_agent_id,
      provider_id: row.provider_id || 'mock',
      execution_mode: row.execution_mode || 'mock',
      attempts: Number(row.attempts || 0),
      max_attempts: Number(row.max_attempts || 3),
      result: row.result ? JSON.parse(row.result) : null,
      error: row.error,
      created_at: Number(row.created_at),
      started_at: row.started_at ? Number(row.started_at) : null,
      completed_at: row.completed_at ? Number(row.completed_at) : null,
    };
  }
}
