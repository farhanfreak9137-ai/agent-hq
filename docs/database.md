# Agent HQ — Database & Persistence Architecture (Phase 3A)

Agent HQ uses a server-side SQLite relational persistence layer powered by `better-sqlite3` with Write-Ahead Logging (`WAL`) enabled for high-concurrency read/write operations and strict foreign key integrity.

---

## 1. Database Schema

The database file resides in `data/agenthq.db`. In test environments, an isolated in-memory database (`:memory:`) is instantiated.

### Tables & Relationships

```
+---------------+       +------------------+       +-------------------+
|     users     |       |     missions     |       |  provider_configs |
+---------------+       +------------------+       +-------------------+
| id (PK)       |       | id (PK)          |       | id (PK)           |
| username      |       | title            |       | name              |
| password_hash |       | status           |       | is_enabled        |
| role          |       | total_nodes      |       | timeout_ms        |
| created_at    |       | completed_nodes  |       | max_concurrency   |
+---------------+       +--------+---------+       | models (JSON)     |
                                 |                 +-------------------+
                                 | 1:N
                                 v
+---------------+       +--------+---------+       +-------------------+
|    agents     |       |      tasks       |       | task_dependencies |
+---------------+       +------------------+       +-------------------+
| id (PK)       | 1:N   | id (PK)          | 1:N   | task_id (PK, FK)  |
| name          |<------+ mission_id (FK)  +------>| depends_on (PK,FK)|
| role          |       | assigned_agent_id|       +-------------------+
| status        |       | status           |
| capabilities  |       | priority         | 1:N   +-------------------+
| current_room  |       | execution_mode   +------>|  task_executions  |
| position_x/y  |       | attempts         |       +-------------------+
+-------+-------+       +------------------+       | id (PK)           |
        |                                          | task_id (FK)      |
        | 1:N                                      | agent_id          |
        v                                          | duration_ms       |
+-------+-------+       +------------------+       | status            |
|memory_entries |       |     messages     |       +-------------------+
+---------------+       +------------------+
| id (PK)       |       | id (PK)          |       +-------------------+
| agent_id (FK) |       | source_agent_id  |       |    audit_logs     |
| type          |       | target_agent_id  |       +-------------------+
| content       |       | content          |       | actor_id/name     |
| timestamp     |       | type, task_id    |       | action, resource  |
+---------------+       +------------------+       +-------------------+
```

---

## 2. Repository Layer Abstraction

All database operations are mediated by typed repository classes in `server/repositories/`:
- `UserRepository`: User query, authentication lookups, creation.
- `AgentRepository`: Agent models, positions, statistics, and live states.
- `TaskRepository`: Tasks, dependency graphs, execution history records.
- `MissionRepository`: High-level initiatives and DAG progression.
- `MessageRepository`: Inter-agent communication and handover payloads.
- `MemoryRepository`: Session/task memory with automated retention pruning (max 80 entries).
- `EventRepository`: Lifecycle event persistence.
- `AuditRepository`: Security-sensitive audit log trails.
- `ProviderConfigRepository`: Safe provider configuration without secret storage.

---

## 3. Resumable Orchestration & Restart Recovery

On server boot, `recoverInterruptedTasks(db)` scans for tasks stuck in `RUNNING` or `ASSIGNED` states and transitions them to `INTERRUPTED`. Completed tasks remain untouched to guarantee non-duplication of completed work.
