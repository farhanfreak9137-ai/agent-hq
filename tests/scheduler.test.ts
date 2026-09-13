import { Scheduler } from '../src/orchestration/Scheduler';
import { TaskGraph } from '../src/orchestration/TaskGraph';
import { AgentManager } from '../src/agents/AgentManager';

export async function testScheduler() {
  console.log('--- Testing Scheduler Graph Execution & Concurrency ---');

  // Test 1: Concurrency limit during executeGraph
  {
    const graph = new TaskGraph({ name: 'concurrency-test' });
    graph.addNode({ id: 'task-1', title: 'Task 1', assignedAgentId: 'sentinel', maxRetries: 0 } as any);
    graph.addNode({ id: 'task-2', title: 'Task 2', assignedAgentId: 'nova', maxRetries: 0 } as any);
    graph.addNode({ id: 'task-3', title: 'Task 3', assignedAgentId: 'pixel', maxRetries: 0 } as any);
    graph.addNode({ id: 'task-4', title: 'Task 4', assignedAgentId: 'atlas', maxRetries: 0 } as any);

    let active = 0;
    let maxObserved = 0;

    // Spy on executeTask
    const origExecute = AgentManager.executeTask.bind(AgentManager);
    AgentManager.executeTask = async (agentId, task, context) => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, 40));
      active--;
      return { taskId: task.id, agentId, success: true, stepsExecuted: 1 };
    };

    const scheduler = new Scheduler({ maxConcurrentTasks: 2, stepDelayMs: 10 });
    const success = await scheduler.executeGraph(graph);

    // Restore
    AgentManager.executeTask = origExecute;

    if (!success) {
      throw new Error('Expected graph execution to succeed');
    }
    if (maxObserved > 2) {
      throw new Error(`Concurrency violated: max observed = ${maxObserved}, expected <= 2`);
    }
    console.log(`[PASS] Scheduler max concurrency respected (max active: ${maxObserved}, success: ${success})`);
  }

  // Test 2: Task Retries on transient failure
  {
    const graph = new TaskGraph({ name: 'retry-test' });
    graph.addNode({ id: 'retry-node', title: 'Retry Node', assignedAgentId: 'sentinel', maxRetries: 2 } as any);

    let attempts = 0;
    const origExecute = AgentManager.executeTask.bind(AgentManager);
    AgentManager.executeTask = async (agentId, task, context) => {
      attempts++;
      if (attempts < 3) {
        return { taskId: task.id, agentId, success: false, error: 'Transient mock error' };
      }
      return { taskId: task.id, agentId, success: true };
    };

    const scheduler = new Scheduler({ maxConcurrentTasks: 1, retryDelayMs: 20 });
    const success = await scheduler.executeGraph(graph);
    AgentManager.executeTask = origExecute;

    if (!success || attempts !== 3) {
      throw new Error(`Expected retry success after 3 attempts, got ${attempts} attempts (success=${success})`);
    }
    console.log(`[PASS] Scheduler retried failed node successfully (${attempts} attempts)`);
  }

  // Test 3: AbortSignal / Cancellation
  {
    const graph = new TaskGraph({ name: 'cancel-test' });
    graph.addNode({ id: 'c1', title: 'First Task', assignedAgentId: 'sentinel' } as any);
    graph.addNode({ id: 'c2', title: 'Second Task', dependencies: ['c1'], assignedAgentId: 'nova' } as any);

    const abortController = new AbortController();
    const origExecute = AgentManager.executeTask.bind(AgentManager);
    AgentManager.executeTask = async (agentId, task, context) => {
      abortController.abort();
      return { taskId: task.id, agentId, success: true };
    };

    const scheduler = new Scheduler({ maxConcurrentTasks: 1 });
    const completed = await scheduler.executeGraph(graph, abortController.signal);
    AgentManager.executeTask = origExecute;

    if (completed) {
      throw new Error('Scheduler should have reported false when aborted');
    }
    if (graph.status !== 'cancelled') {
      throw new Error(`Graph status should be cancelled, got: ${graph.status}`);
    }
    console.log('[PASS] Scheduler aborted cleanly when signal fired');
  }

  console.log('Scheduler tests passed successfully!\n');
}

if (process.argv[1]?.endsWith('scheduler.test.ts')) {
  testScheduler().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
  });
}
