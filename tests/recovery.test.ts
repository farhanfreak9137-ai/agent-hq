import { getDatabase } from '../server/db/database.ts';
import { seedDatabase, recoverInterruptedTasks } from '../server/db/migrations.ts';
import { createRepositories } from '../server/repositories/index.ts';

export async function testRecoveryAndResumption(): Promise<boolean> {
  console.log('\n--- 2. Testing Resumable Orchestration & Restart Recovery ---');

  const db = getDatabase({ inMemory: true });
  seedDatabase(db);
  const repos = createRepositories(db);

  // Setup: Create mission and a 3-task pipeline: Task A (COMPLETED), Task B (RUNNING during crash), Task C (BLOCKED on B)
  const now = Date.now();

  repos.missions.create({
    id: 'mission_rec_01',
    title: 'Recovery Resilience Test Mission',
    description: 'Validates crash recovery and task durability',
    status: 'in_progress',
    total_nodes: 3,
    completed_nodes: 1,
    summary: null,
    error: null,
    started_at: now - 6000,
    completed_at: null,
  });

  repos.tasks.create({
    id: 'task_rec_a',
    mission_id: 'mission_rec_01',
    title: 'Task A (Completed)',
    description: 'Finished before crash',
    priority: 'HIGH',
    status: 'COMPLETED',
    assigned_agent_id: 'sentinel',
    provider_id: 'mock',
    execution_mode: 'mock',
    attempts: 1,
    max_attempts: 3,
    result: { summary: 'Task A finished cleanly' },
    error: null,
    started_at: now - 5000,
    completed_at: now - 4000,
  });

  repos.tasks.create({
    id: 'task_rec_b',
    mission_id: 'mission_rec_01',
    title: 'Task B (In Flight During Crash)',
    description: 'Was running when server stopped',
    priority: 'HIGH',
    status: 'RUNNING',
    assigned_agent_id: 'nova',
    provider_id: 'mock',
    execution_mode: 'mock',
    attempts: 1,
    max_attempts: 3,
    result: null,
    error: null,
    started_at: now - 1000,
    completed_at: null,
  });

  repos.tasks.create({
    id: 'task_rec_c',
    mission_id: 'mission_rec_01',
    title: 'Task C (Dependent on B)',
    description: 'Waiting for B to complete',
    priority: 'HIGH',
    status: 'PENDING',
    assigned_agent_id: 'echo',
    provider_id: 'mock',
    execution_mode: 'mock',
    attempts: 0,
    max_attempts: 3,
    result: null,
    error: null,
    dependencies: ['task_rec_b'],
    started_at: null,
    completed_at: null,
  });

  // Simulate server restart: trigger recovery
  const recoveredCount = recoverInterruptedTasks(db);
  if (recoveredCount !== 1) {
    throw new Error(`Recovery failed: expected 1 interrupted task recovered, got ${recoveredCount}`);
  }
  console.log('✓ Server restart recovery routine executed successfully');

  // Verify Task A remains COMPLETED (Never duplicated or modified)
  const taskA = repos.tasks.getById('task_rec_a');
  if (!taskA || taskA.status !== 'COMPLETED' || (taskA.result as any)?.summary !== 'Task A finished cleanly') {
    throw new Error('Recovery integrity failed: completed task was altered or corrupted');
  }
  console.log('✓ Task A remains strictly COMPLETED without duplicate execution');

  // Verify Task B transitioned to INTERRUPTED with error reason
  const taskB = repos.tasks.getById('task_rec_b');
  if (!taskB || taskB.status !== 'INTERRUPTED' || !taskB.error?.includes('interrupted by server restart')) {
    throw new Error(`Recovery failed: Task B is not in INTERRUPTED status (got ${taskB?.status})`);
  }
  console.log('✓ Task B safely detected as INTERRUPTED');

  // Verify Task C remains PENDING/BLOCKED on B and did not execute prematurely
  const taskC = repos.tasks.getById('task_rec_c');
  if (!taskC || taskC.status !== 'PENDING' || taskC.started_at !== null) {
    throw new Error('Recovery failed: dependent Task C started prematurely');
  }
  console.log('✓ Dependent Task C remains unexecuted until upstream task resolution');

  // Verify recovery events and audit logs were recorded
  const audit = repos.audit.getRecent(5, { action: 'task.interrupted_recovered' });
  if (audit.length === 0 || audit[0].resource_id !== 'task_rec_b') {
    throw new Error('Recovery failed: audit log for interrupted task not found');
  }
  console.log('✓ Recovery audit trail and lifecycle events recorded in database');

  return true;
}
