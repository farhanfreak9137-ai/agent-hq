import { BossOrchestrator } from '../src/orchestration/BossOrchestrator';
import { TaskPlanner } from '../src/orchestration/TaskPlanner';
import { Scheduler } from '../src/orchestration/Scheduler';
import { ProviderRegistry } from '../src/agents/ProviderRegistry';
import { AgentManager } from '../src/agents/AgentManager';
import { TaskManager } from '../src/tasks/TaskManager';
import { EventBus } from '../src/events/EventBus';
import { MessageBus } from '../src/communication/MessageBus';
import { MockAgentProvider } from '../src/agents/AgentProvider';
import { GeminiProvider } from '../src/agents/providers/GeminiProvider';
import { AntigravityProvider } from '../src/agents/providers/AntigravityProvider';
import { TaskGraph } from '../src/orchestration/TaskGraph';

export async function testSmoke() {
  console.log('====================================================');
  console.log('AGENT HQ — Phase 2.5 Real Provider Smoke Test Suite');
  console.log('====================================================\n');

  const registry = ProviderRegistry.getInstance();
  if (!registry.get('mock')) registry.register(new MockAgentProvider());
  if (!registry.get('gemini')) registry.register(new GeminiProvider());
  if (!registry.get('antigravity')) registry.register(new AntigravityProvider());

  // TEST 1: Provider Reality & Availability Check
  console.log('--- 1. Provider Reality & Health Check ---');
  const healthMap = await registry.healthCheckAll();
  const mockHealth = healthMap.get('mock');
  const geminiHealth = healthMap.get('gemini');
  const antigravityHealth = healthMap.get('antigravity');

  console.log(`[Health] Mock Provider: ${mockHealth?.status.toUpperCase()} (${mockHealth?.message || 'Ready'})`);
  console.log(`[Health] Gemini Provider: ${geminiHealth?.status.toUpperCase()} (${geminiHealth?.message || 'Ready'})`);
  console.log(`[Health] Antigravity Provider: ${antigravityHealth?.status.toUpperCase()} (${antigravityHealth?.message || 'Ready'})`);

  if (mockHealth?.status !== 'available') {
    throw new Error('Mock provider must always be available as baseline');
  }

  // TEST 2: Fallback Validation when external provider unavailable
  console.log('\n--- 2. Fallback Resolution Validation ---');
  const novaAgent = AgentManager.getById('nova')!;
  const resolution = registry.resolveProviderForAgent(novaAgent);

  if (antigravityHealth?.status !== 'available') {
    if (!resolution.isFallback || resolution.provider.id !== 'mock') {
      throw new Error(`Expected fallback to 'mock' provider when antigravity is ${antigravityHealth?.status}, got: ${resolution.provider.id}`);
    }
    console.log(`[PASS] Transparent fallback verified: Agent NOVA (${novaAgent.providerId}) safely routed to [${resolution.provider.name}] (${resolution.reason})`);
  } else {
    console.log(`[PASS] Antigravity is active locally; executing direct without fallback.`);
  }

  // TEST 3: Smoke Test DAG Execution via BossOrchestrator -> TaskGraph -> Scheduler -> AgentRuntime -> BOSS
  console.log('\n--- 3. Full Pipeline Execution Smoke Test ---');
  const orchestrator = BossOrchestrator.getInstance();
  const capturedEvents: string[] = [];

  const unsub = EventBus.on('*', (ev) => {
    if (ev.type.startsWith('runtime.') || ev.type.startsWith('task.') || ev.type.includes('message') || ev.type.startsWith('orchestration.')) {
      capturedEvents.push(ev.type);
    }
  });

  const initiativeResult = await orchestrator.runArchitectureAnalysis('nova');
  // Allow any pending async microtasks to settle
  await new Promise((r) => setTimeout(r, 50));
  unsub();

  if (!initiativeResult.success) {
    throw new Error(`Smoke test initiative failed: ${initiativeResult.error}`);
  }

  console.log(`[PASS] Initiative completed successfully in ${initiativeResult.durationMs}ms`);
  console.log(`[PASS] BOSS Result Synthesis: "${initiativeResult.summary}"`);

  // Verify event stream lifecycle
  const expectedEvents = ['runtime.started', 'runtime.completed', 'task.completed', 'agent.message_sent'];
  for (const exp of expectedEvents) {
    if (!capturedEvents.includes(exp)) {
      throw new Error(`Expected event "${exp}" was not emitted in EventBus stream (observed: ${capturedEvents.join(', ')})`);
    }
  }
  console.log(`[PASS] Full typed event lifecycle verified: [${expectedEvents.join(' -> ')}]`);

  // Verify message delivered to BOSS
  const bossMessages = MessageBus.getHistory('boss');
  const receivedFromNova = bossMessages.find((m) => m.fromAgentId === 'nova');
  if (!receivedFromNova) {
    throw new Error('Deliverable message was not received by BOSS in MessageBus');
  }
  console.log(`[PASS] BOSS received deliverable from NOVA: "${receivedFromNova.content}"`);

  // TEST 4: Controlled Failure & Cascading Block Validation
  console.log('\n--- 4. Failure Path & Cascading Block Validation ---');
  {
    const failGraph = new TaskGraph('graph-failure-test', 'Failure Path Test', 'initiative-fail-test');
    failGraph.addNode({
      id: 'failing-task',
      taskId: 't-fail',
      title: 'Intentional Failing Task',
      assignedAgentId: 'sentinel',
      dependencies: [],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 0,
    });

    failGraph.addNode({
      id: 'dependent-task',
      taskId: 't-dep',
      title: 'Downstream Task Depending on Failure',
      assignedAgentId: 'nova',
      dependencies: ['failing-task'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 0,
    });

    // Mock executeTask to simulate controlled failure
    const origExecute = AgentManager.executeTask.bind(AgentManager);
    AgentManager.executeTask = async (agentId, task, context) => {
      if (task.title.includes('Failing')) {
        return {
          taskId: task.id,
          agentId,
          success: false,
          error: 'Simulated runtime failure for diagnostic validation',
          executionMode: 'mock',
        };
      }
      return { taskId: task.id, agentId, success: true, executionMode: 'mock' };
    };

    const scheduler = new Scheduler({ maxConcurrentTasks: 1, stepDelayMs: 10 });
    const completed = await scheduler.executeGraph(failGraph);
    AgentManager.executeTask = origExecute;

    if (completed) {
      throw new Error('Scheduler should have reported failure for failing task');
    }

    const depNode = failGraph.getNode('dependent-task');
    if (depNode?.status !== 'blocked') {
      throw new Error(`Expected dependent task to be 'blocked', got: ${depNode?.status}`);
    }
    console.log(`[PASS] Failure safely handled and cascaded 'blocked' status to dependent task without crashing.`);
  }

  console.log('\n====================================================');
  console.log('PHASE 2.5 REAL PROVIDER SMOKE TESTS PASSED 100%!');
  console.log('====================================================\n');
}

if (process.argv[1]?.endsWith('smoke.test.ts')) {
  testSmoke()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FAIL]', err);
      process.exit(1);
    });
}
