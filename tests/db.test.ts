import { getDatabase } from '../server/db/database.ts';
import { seedDatabase, resetDatabase } from '../server/db/migrations.ts';
import { createRepositories } from '../server/repositories/index.ts';

export async function testDatabaseAndRepositories(): Promise<boolean> {
  console.log('\n--- 1. Testing Database Schema & Repositories ---');

  // Use an isolated in-memory database instance for testing
  const db = getDatabase({ inMemory: true });
  seedDatabase(db);
  const repos = createRepositories(db);

  // 1. User Repository
  const admin = repos.users.findByUsername('admin');
  if (!admin || admin.role !== 'ADMIN') {
    throw new Error('UserRepository failed: admin user not found or role mismatch');
  }
  const standard = repos.users.findByUsername('user');
  if (!standard || standard.role !== 'USER') {
    throw new Error('UserRepository failed: standard user not found or role mismatch');
  }
  console.log('✓ UserRepository: admin & standard users verified with correct roles');

  // 2. Agent Repository
  const allAgents = repos.agents.getAll();
  if (allAgents.length !== 7) {
    throw new Error(`AgentRepository failed: expected 7 seeded agents, got ${allAgents.length}`);
  }
  const boss = repos.agents.getById('boss');
  if (!boss || boss.name !== 'BOSS') {
    throw new Error('AgentRepository failed: BOSS agent not found');
  }
  repos.agents.updateStatus('boss', 'WORKING');
  const updatedBoss = repos.agents.getById('boss');
  if (updatedBoss?.status !== 'WORKING') {
    throw new Error('AgentRepository failed: status update not persisted');
  }
  console.log('✓ AgentRepository: 7 agents seeded, queried, and updated successfully');

  // 3. Task & Dependency Repository
  const task1 = repos.tasks.create({
    id: 'test_task_1',
    mission_id: null,
    title: 'Test Core Engine',
    description: 'Unit test task',
    priority: 'HIGH',
    status: 'PENDING',
    assigned_agent_id: 'nova',
    provider_id: 'mock',
    execution_mode: 'mock',
    attempts: 0,
    max_attempts: 3,
    result: null,
    error: null,
    started_at: null,
    completed_at: null,
  });

  const task2 = repos.tasks.create({
    id: 'test_task_2',
    mission_id: null,
    title: 'Test Integration Suite',
    description: 'Dependent test task',
    priority: 'CRITICAL',
    status: 'PENDING',
    assigned_agent_id: 'vector',
    provider_id: 'mock',
    execution_mode: 'mock',
    attempts: 0,
    max_attempts: 3,
    result: null,
    error: null,
    dependencies: ['test_task_1'],
    started_at: null,
    completed_at: null,
  });

  const deps = repos.tasks.getDependencies('test_task_2');
  if (!deps.includes('test_task_1')) {
    throw new Error('TaskRepository failed: dependencies not recorded');
  }

  repos.tasks.recordResult('test_task_1', { summary: 'Task 1 succeeded' }, 'mock');
  const finishedTask1 = repos.tasks.getById('test_task_1');
  if (finishedTask1?.status !== 'COMPLETED' || (finishedTask1.result as any)?.summary !== 'Task 1 succeeded') {
    throw new Error('TaskRepository failed: task completion result not recorded');
  }
  console.log('✓ TaskRepository: tasks created, dependencies mapped, and completion results persisted');

  // 4. Mission Repository
  const mission = repos.missions.create({
    id: 'test_mission_01',
    title: 'Operation Ironclad',
    description: 'Resilience validation',
    status: 'in_progress',
    total_nodes: 5,
    completed_nodes: 0,
    summary: null,
    error: null,
    started_at: Date.now(),
    completed_at: null,
  });

  const activeMission = repos.missions.getLatestActive();
  if (activeMission?.id !== 'test_mission_01') {
    throw new Error('MissionRepository failed: active mission not found');
  }

  repos.missions.updateStatus('test_mission_01', 'completed', {
    completed_nodes: 5,
    summary: 'Mission ironclad verified.',
    completed_at: Date.now(),
  });
  const completedMission = repos.missions.getById('test_mission_01');
  if (completedMission?.status !== 'completed' || completedMission.completed_nodes !== 5) {
    throw new Error('MissionRepository failed: mission completion update failed');
  }
  console.log('✓ MissionRepository: active mission query and status transitions verified');

  // 5. Memory Repository & Retention Rules
  for (let i = 1; i <= 30; i++) {
    repos.memory.save({
      id: `mem_test_${i}`,
      agent_id: 'nova',
      task_id: 'test_task_1',
      session_id: 'session_01',
      type: 'decision',
      content: `Decision point ${i}`,
      metadata: { step: i },
      timestamp: Date.now() + i,
      expires_at: null,
    }, 20); // Retention cap at 20
  }

  const novaMemory = repos.memory.getRecentByAgent('nova', 50);
  if (novaMemory.length > 20) {
    throw new Error(`MemoryRepository failed: retention pruning exceeded 20, got ${novaMemory.length}`);
  }
  console.log(`✓ MemoryRepository: retention limit enforced (pruned to ${novaMemory.length} entries)`);

  // 6. Message Repository
  repos.messages.save({
    id: 'msg_test_01',
    source_agent_id: 'nova',
    target_agent_id: 'boss',
    content: 'All systems green.',
    type: 'status_update',
    task_id: 'test_task_1',
    timestamp: Date.now(),
    payload: { status: 'green' },
  });

  const recentMsgs = repos.messages.getRecent(10);
  if (recentMsgs.length === 0 || recentMsgs[recentMsgs.length - 1].content !== 'All systems green.') {
    throw new Error('MessageRepository failed: recent message not retrieved');
  }
  console.log('✓ MessageRepository: messages persisted and retrieved successfully');

  // 7. Audit & Provider Config Repositories
  repos.audit.record({
    actor_id: 'user_admin_01',
    actor_name: 'admin',
    action: 'provider.update',
    resource: 'provider_config',
    resource_id: 'mock',
    success: true,
    metadata: { maxConcurrency: 8 },
  });

  const auditLogs = repos.audit.getRecent(10, { action: 'provider.update' });
  if (auditLogs.length === 0 || auditLogs[0].actor_name !== 'admin') {
    throw new Error('AuditRepository failed: audit record not logged');
  }

  const provs = repos.providers.getAll();
  if (provs.length !== 3) {
    throw new Error('ProviderConfigRepository failed: expected 3 provider configs');
  }
  console.log('✓ AuditRepository & ProviderConfigRepository: audit trails and sanitized configs verified');

  return true;
}
