import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

/**
 * Seed initial administrative & standard users, agents, and provider configs.
 */
export function seedDatabase(db: Database.Database): void {
  const now = Date.now();

  // 1. Seed Users if table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminHash = bcrypt.hashSync('adminpassword123', 10);
    const userHash = bcrypt.hashSync('userpassword123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('user_admin_01', 'admin', adminHash, 'ADMIN', now, now);
    insertUser.run('user_standard_01', 'user', userHash, 'USER', now, now);
  }

  // 2. Seed Provider Configurations if empty
  const provCount = db.prepare('SELECT COUNT(*) as count FROM provider_configs').get() as { count: number };
  if (provCount.count === 0) {
    const insertProv = db.prepare(`
      INSERT INTO provider_configs (id, name, is_enabled, timeout_ms, max_concurrency, models, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProv.run(
      'mock',
      'Local Autonomous Engine',
      1,
      30000,
      4,
      JSON.stringify(['mock-engine-v1']),
      now,
      now
    );

    insertProv.run(
      'gemini',
      'Google Gemini Provider',
      1,
      45000,
      2,
      JSON.stringify(['gemini-2.5-flash', 'gemini-2.5-pro']),
      now,
      now
    );

    insertProv.run(
      'antigravity',
      'Google Antigravity Provider',
      1,
      60000,
      2,
      JSON.stringify(['antigravity-core']),
      now,
      now
    );
  }

  // 3. Seed Agents if empty
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  if (agentCount.count === 0) {
    const insertAgent = db.prepare(`
      INSERT INTO agents (id, name, role, system_directive, provider_id, status, capabilities, assigned_tools, current_room_id, position_x, position_y, stats, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultAgents = [
      {
        id: 'boss',
        name: 'BOSS',
        role: 'Orchestrator',
        system_directive: 'Autonomous central orchestrator and hierarchical task planner',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['orchestration'],
        assigned_tools: ['tool_task_planner'],
        current_room_id: 'room_command',
        position_x: 760,
        position_y: 155,
      },
      {
        id: 'nova',
        name: 'NOVA',
        role: 'Coder',
        system_directive: 'Principal software architect and implementation lead',
        provider_id: 'antigravity',
        status: 'IDLE',
        capabilities: ['coding'],
        assigned_tools: ['tool_code_analysis'],
        current_room_id: 'room_coding',
        position_x: 260,
        position_y: 160,
      },
      {
        id: 'atlas',
        name: 'ATLAS',
        role: 'Researcher',
        system_directive: 'Lead research scientist and intelligence analyst',
        provider_id: 'gemini',
        status: 'IDLE',
        capabilities: ['research'],
        assigned_tools: ['tool_search'],
        current_room_id: 'room_research',
        position_x: 260,
        position_y: 820,
      },
      {
        id: 'pixel',
        name: 'PIXEL',
        role: 'Designer',
        system_directive: 'Principal UI/UX architect and creative director',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['design'],
        assigned_tools: ['tool_design_system'],
        current_room_id: 'room_design',
        position_x: 260,
        position_y: 490,
      },
      {
        id: 'echo',
        name: 'ECHO',
        role: 'Reviewer',
        system_directive: 'Lead code auditor and architectural review authority',
        provider_id: 'antigravity',
        status: 'IDLE',
        capabilities: ['review'],
        assigned_tools: ['tool_file_inspection'],
        current_room_id: 'room_review',
        position_x: 1260,
        position_y: 820,
      },
      {
        id: 'sentinel',
        name: 'SENTINEL',
        role: 'Security',
        system_directive: 'Chief zero-trust security engineer and cryptographic auditor',
        provider_id: 'gemini',
        status: 'IDLE',
        capabilities: ['security'],
        assigned_tools: ['tool_security_scanner'],
        current_room_id: 'room_security',
        position_x: 1260,
        position_y: 160,
      },
      {
        id: 'vector',
        name: 'VECTOR',
        role: 'Tester',
        system_directive: 'Automated test engineer and chaos simulation specialist',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['testing'],
        assigned_tools: ['tool_test_runner'],
        current_room_id: 'room_testing',
        position_x: 1260,
        position_y: 490,
      },
    ];

    for (const a of defaultAgents) {
      insertAgent.run(
        a.id,
        a.name,
        a.role,
        a.system_directive,
        a.provider_id,
        a.status,
        JSON.stringify(a.capabilities),
        JSON.stringify(a.assigned_tools),
        a.current_room_id,
        a.position_x,
        a.position_y,
        JSON.stringify({ tasksCompleted: 0, tasksInProgress: 0, messagesSent: 0, messagesReceived: 0 }),
        now,
        now
      );
    }
  }
}

/**
 * Resets the database and re-seeds it. Intended for development & tests only.
 */
export function resetDatabase(db: Database.Database): void {
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM events;
    DELETE FROM memory_entries;
    DELETE FROM messages;
    DELETE FROM task_executions;
    DELETE FROM task_dependencies;
    DELETE FROM tasks;
    DELETE FROM missions;
    DELETE FROM agents;
    DELETE FROM provider_configs;
    DELETE FROM users;
  `);
  seedDatabase(db);
}

/**
 * Resumable orchestration recovery:
 * Scans for tasks that were in RUNNING or ASSIGNED state when the server stopped.
 * Transitions them to INTERRUPTED state to prevent duplicate/hanging executions.
 */
export function recoverInterruptedTasks(db: Database.Database): number {
  const now = Date.now();
  const interrupted = db.prepare(`
    SELECT id, title, mission_id, assigned_agent_id
    FROM tasks
    WHERE status IN ('RUNNING', 'ASSIGNED')
  `).all() as { id: string; title: string; mission_id: string | null; assigned_agent_id: string | null }[];

  if (interrupted.length === 0) {
    return 0;
  }

  const updateStmt = db.prepare(`
    UPDATE tasks
    SET status = 'INTERRUPTED', error = 'Execution interrupted by server restart.'
    WHERE id = ?
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, action, resource, resource_id, success, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (id, type, timestamp, message, agent_id, task_id, mission_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const t of interrupted) {
      updateStmt.run(t.id);
      insertAudit.run(
        `audit_${t.id}_${now}`,
        'system',
        'SYSTEM_RECOVERY',
        'task.interrupted_recovered',
        'task',
        t.id,
        1,
        JSON.stringify({ reason: 'server_restart', previousStatus: 'RUNNING' }),
        now
      );
      insertEvent.run(
        `ev_${t.id}_${now}`,
        'task.interrupted',
        now,
        `Task "${t.title}" was marked INTERRUPTED following server recovery.`,
        t.assigned_agent_id,
        t.id,
        t.mission_id,
        JSON.stringify({ recovered: true })
      );
    }
  });

  tx();
  return interrupted.length;
}
