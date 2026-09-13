import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RelevanceScorer } from '../src/memory/RelevanceScorer.ts';
import { LayeredMemory } from '../src/memory/LayeredMemory.ts';
import { AgentContextBuilder } from '../src/agents/AgentContext.ts';
import { TaskPlanner } from '../src/orchestration/TaskPlanner.ts';
import { ProviderRouter } from '../src/agents/ProviderRouter.ts';
import { MockToolExecutor, BUILTIN_CONTROLLED_TOOLS } from '../src/agents/ToolExecutor.ts';
import { ArtifactManager } from '../src/artifacts/ArtifactManager.ts';
import { ReviewWorkflow } from '../src/orchestration/ReviewWorkflow.ts';
import { HumanApprovalManager } from '../src/security/HumanApprovalManager.ts';
import { Scheduler } from '../src/orchestration/Scheduler.ts';
import { TelemetryService } from '../src/telemetry/TelemetryService.ts';
import { BackpressureEnforcer } from '../src/orchestration/BackpressureEnforcer.ts';
import { TaskGraph } from '../src/orchestration/TaskGraph.ts';
import { HandoffProtocol } from '../src/communication/HandoffProtocol.ts';
import { AgentModel, TaskModel } from '../src/types/index.ts';

export async function runPhase3bTests() {
  console.log('\n====================================================');
  console.log('AGENT HQ — Phase 3B Advanced Intelligence Tests');
  console.log('====================================================\n');

  // --- 1. Memory Relevance Scoring & Temporal Decay ---
  console.log('--- 1. Testing Memory Relevance Scoring & Decay ---');
  const now = Date.now();
  const testMemories = [
    {
      id: 'mem_1',
      timestamp: now - 1000 * 60 * 5, // 5 mins ago
      type: 'decision' as const,
      content: 'Selected zero-trust Ed25519 token rotation algorithm for authentication',
      metadata: { importance: 0.9, tags: ['crypto', 'auth'] },
    },
    {
      id: 'mem_2',
      timestamp: now - 1000 * 60 * 120, // 2 hours ago (decayed)
      type: 'observation' as const,
      content: 'CSS contrast ratio passes WCAG AAA guidelines on HUD dark mode',
      metadata: { importance: 0.4, tags: ['ui'] },
    },
    {
      id: 'mem_3',
      timestamp: now - 1000 * 10, // 10 seconds ago
      type: 'tool_used' as const,
      content: 'Executed zero-trust security scanner across all token endpoints',
      metadata: { importance: 0.8, tags: ['security', 'token'] },
    },
  ];

  const scored = RelevanceScorer.scoreAndRank(testMemories, {
    query: 'Ed25519 zero-trust token signing',
    maxEntries: 2,
    tags: ['crypto'],
  });

  assert.strictEqual(scored.length, 2, 'Should return top 2 ranked memories');
  assert.ok(
    scored[0].entry.id === 'mem_1' || scored[0].entry.id === 'mem_3',
    'Crypto/token memories should outrank unrelated UI memories'
  );
  assert.ok(scored[0].score > scored[1].score || scored[0].score >= scored[1].score, 'Scores should be sorted descending');
  console.log('✓ Memory relevance multi-signal scoring and decay verified');

  // --- 2. Layered Memory System ---
  console.log('--- 2. Testing 4-Layer Memory (Working, Task, Persistent, Semantic) ---');
  const layeredMem = new LayeredMemory({ agentId: 'nova', agentRole: 'Coder' });

  layeredMem.rememberLayer('working', {
    type: 'decision',
    content: 'Drafting internal AST visitor pattern',
  });
  layeredMem.rememberLayer('task', {
    type: 'task_started',
    content: 'Working on PR #501 token implementation',
    taskId: 'task_pr_501',
  });

  assert.strictEqual(layeredMem.getWorkingMemory().length, 1, 'Working memory should hold scratchpad entry');
  assert.strictEqual(layeredMem.getTaskMemory().length, 1, 'Task memory should hold active task entry');

  layeredMem.clearTaskMemory();
  assert.strictEqual(layeredMem.getTaskMemory().length, 0, 'Task memory should flush between tasks');
  assert.strictEqual(layeredMem.getWorkingMemory().length, 1, 'Working memory remains intact');
  console.log('✓ Layered memory isolation and task flushing verified');

  // --- 3. Structured Agent Context Bounded Assembly ---
  console.log('--- 3. Testing AgentContextBuilder Bounded Construction ---');
  const dummyAgent: AgentModel = {
    id: 'nova',
    name: 'Nova',
    role: 'Coder',
    roleSymbol: '💻',
    description: 'Senior Systems Architect',
    personality: 'Precise and methodical',
    status: 'WORKING',
    capabilities: ['coding'],
    currentTaskId: 'task_1',
    roomId: 'room_coding',
    deskPosition: { x: 200, y: 200 },
    currentPosition: { x: 200, y: 200 },
    targetPosition: null,
    facing: 'down',
    avatar: { hairStyle: 'short', hairColor: '#fff', skinColor: '#ffe', suitColor: '#000', accentColor: '#0ff' },
    stats: { tasksCompleted: 10, tasksInProgress: 1, messagesSent: 5, messagesReceived: 5, linesOfCodeOrReviews: 500, uptimeSeconds: 3600 },
    createdAt: Date.now(),
  };

  const context = AgentContextBuilder.build({
    agent: dummyAgent,
    layeredMemory: layeredMem,
    availableTools: BUILTIN_CONTROLLED_TOOLS,
    currentTask: {
      id: 'task_1',
      title: 'Build token signer',
      description: 'Implement constant-time cryptographic verification',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignedAgentId: 'nova',
      progress: 50,
      createdAt: Date.now(),
      dependencies: [],
      logs: [],
    },
    maxMemories: 3,
    maxMessages: 3,
  });

  assert.strictEqual(context.agentId, 'nova');
  assert.ok(context.availableTools.some((t) => t.id === 'tool_code_analysis'), 'Should include coding tools');
  assert.ok(!context.availableTools.some((t) => t.id === 'tool_restricted_deploy'), 'Should filter out unauthorized tools');

  const promptBlock = AgentContextBuilder.formatForPrompt(context);
  assert.ok(promptBlock.includes('AGENT IDENTITY: Nova (Coder)'), 'Prompt block should contain identity');
  assert.ok(promptBlock.includes('CURRENT TASK: "Build token signer"'), 'Prompt block should contain task');
  console.log('✓ Structured AgentContext bounded assembly verified');

  // --- 4. Agent Capability Matching & Provider Routing ---
  console.log('--- 4. Testing Capability Matching & Provider Routing ---');
  const planner = new TaskPlanner();
  const bestAgent = planner.recommendAgentForCapabilities(['coding']);
  assert.strictEqual(bestAgent, 'nova', 'Coding capabilities should recommend Nova');

  const router = ProviderRouter.getInstance();
  const route = await router.resolveRoute({
    task: { id: 't1', title: 'Code audit', description: '', status: 'QUEUED', priority: 'MEDIUM', assignedAgentId: 'nova', progress: 0, createdAt: now, dependencies: [], logs: [] },
    agent: dummyAgent,
  });
  assert.ok(route.providerId, 'Should resolve valid provider ID');
  assert.ok(route.modelId, 'Should resolve model selection');
  console.log(`✓ Provider routing resolved: [${route.providerId}] using model [${route.modelId}] (${route.executionMode})`);

  // --- 5. Tool Permissions & Human Approval Workflow ---
  console.log('--- 5. Testing Tool Risk Policies & Human Approval Boundary ---');
  const executor = new MockToolExecutor(10);
  const safeTool = BUILTIN_CONTROLLED_TOOLS.find((t) => t.id === 'tool_code_analysis')!;
  const restrictedTool = BUILTIN_CONTROLLED_TOOLS.find((t) => t.id === 'tool_restricted_deploy')!;

  // Safe tool runs automatically
  const safeResult = await executor.execute(safeTool, {
    agentCapabilities: ['coding'],
  });
  assert.strictEqual(safeResult.success, true, 'Safe tool should execute automatically');

  // Restricted tool requires human approval
  const approvalPromise = executor.execute(restrictedTool, {
    agentCapabilities: ['security'],
    taskId: 'task_deploy_test',
  });

  // Check pending requests
  const pending = HumanApprovalManager.getInstance().getPendingRequests();
  assert.ok(pending.length > 0, 'Restricted tool execution should queue human approval request');
  assert.strictEqual(pending[0].toolId, 'tool_restricted_deploy');

  // Human authorizes request
  HumanApprovalManager.getInstance().approve(pending[0].id, 'security_admin');
  const restrictedResult = await approvalPromise;
  assert.strictEqual(restrictedResult.success, true, 'Approved tool execution should complete successfully');

  // Dangerous arbitrary tool is unconditionally blocked
  const maliciousTool = {
    id: 'tool_shell_exec',
    name: 'Shell Execution',
    description: 'Runs bash command',
    capability: 'coding' as const,
  };
  const blockedResult = await executor.execute(maliciousTool, { agentCapabilities: ['coding'] });
  assert.strictEqual(blockedResult.success, false);
  assert.ok(blockedResult.error?.includes('CRITICAL RISK'), 'Arbitrary shell must be strictly blocked');
  console.log('✓ Tool risk policies, human approval gate, and safety boundaries verified');

  // --- 6. Artifact System & Handoff Protocol ---
  console.log('--- 6. Testing Artifact Creation & Typed Handoffs ---');
  const artManager = ArtifactManager.getInstance();
  const artifact = artManager.createArtifact({
    taskId: 'task_crypto_1',
    agentId: 'nova',
    type: 'code',
    title: 'Ed25519 Signing Routine',
    content: 'export function sign(msg, key) { return nacl.sign.detached(msg, key); }',
  });

  assert.strictEqual(artifact.title, 'Ed25519 Signing Routine');
  assert.strictEqual(artManager.getByTaskId('task_crypto_1').length, 1);

  const handoff = HandoffProtocol.createHandoff({
    sourceAgentId: 'nova',
    targetAgentId: 'echo',
    taskId: 'task_crypto_1',
    reason: 'Code review required',
    summary: 'Completed Ed25519 token rotation with constant-time lookup',
    artifacts: [artifact],
    confidence: 0.98,
  });

  assert.strictEqual(handoff.confidence, 0.98);
  assert.strictEqual(handoff.artifacts.length, 1);
  HandoffProtocol.transmitHandoff(handoff);
  console.log('✓ Artifact creation and typed handoff transmission verified');

  // --- 7. Review Loop Termination & Infinite-Loop Prevention ---
  console.log('--- 7. Testing Review Loops & Infinite-Loop Termination Guard ---');
  ReviewWorkflow.clear();

  const reviewReq = ReviewWorkflow.initiateReview({
    taskId: 'task_pr_test',
    authorAgentId: 'nova',
    reviewerAgentId: 'echo',
    maxCycles: 2,
    artifacts: [artifact],
  });

  assert.strictEqual(reviewReq.cycle, 1);
  assert.strictEqual(reviewReq.status, 'PENDING');

  // Reviewer requests changes (cycle 1 -> 2)
  const afterChange = ReviewWorkflow.submitVerdict(reviewReq.id, 'REQUEST_CHANGES', 'Add constant-time memory zeroing');
  assert.strictEqual(afterChange.cycle, 2);
  assert.strictEqual(afterChange.status, 'CHANGES_REQUESTED');

  // Reviewer requests changes again at cycle 2 (exceeds maxCycles=2)
  const terminatedReview = ReviewWorkflow.submitVerdict(reviewReq.id, 'REQUEST_CHANGES', 'Still missing zeroing');
  assert.strictEqual(terminatedReview.status, 'EXCEEDED_MAX_CYCLES');
  assert.ok(terminatedReview.feedback?.includes('Escalating to BOSS'), 'Must terminate and escalate to BOSS');
  console.log('✓ Infinite-loop prevention terminated review cycle strictly at limit');

  // --- 8. Telemetry & Correlation IDs ---
  console.log('--- 8. Testing Telemetry & Correlation IDs ---');
  const telemetry = TelemetryService.getInstance();
  telemetry.clear();

  telemetry.recordExecution({
    correlation: { missionId: 'mission_aegis', taskId: 'task_crypto', executionId: 'exec_001' },
    agentId: 'nova',
    providerId: 'mock',
    toolId: 'tool_code_analysis',
    durationMs: 45,
    success: true,
  });

  const agentStats = telemetry.getAgentTelemetry('nova');
  assert.strictEqual(agentStats.tasksCompleted, 1);
  assert.strictEqual(agentStats.avgDurationMs, 45);
  assert.strictEqual(agentStats.toolUsage['tool_code_analysis'], 1);

  const sysMetrics = telemetry.getSystemMetrics();
  assert.strictEqual(sysMetrics.totalTasks, 1);
  assert.strictEqual(sysMetrics.successRate, 100);
  console.log('✓ Telemetry and correlation ID tracking verified');

  // --- 9. Backpressure Enforcer ---
  console.log('--- 9. Testing Backpressure Limits ---');
  const backpressure = BackpressureEnforcer.getInstance();
  backpressure.reset();
  backpressure.setLimits({ maxPerAgentConcurrency: 2 });

  assert.strictEqual(backpressure.canAcceptTask('nova').allowed, true);
  backpressure.acquireTaskSlot('nova');
  assert.strictEqual(backpressure.canAcceptTask('nova').allowed, true);
  backpressure.acquireTaskSlot('nova');

  // 3rd task should be rejected with AGENT_BUSY
  const thirdCheck = backpressure.canAcceptTask('nova');
  assert.strictEqual(thirdCheck.allowed, false);
  assert.strictEqual(thirdCheck.statusCode, 'AGENT_BUSY');

  backpressure.releaseTaskSlot('nova');
  assert.strictEqual(backpressure.canAcceptTask('nova').allowed, true, 'Slot should be freed');
  console.log('✓ Backpressure saturation and slot release verified');

  // --- 10. Smart Retries & Error Classification ---
  console.log('--- 10. Testing Smart Retries Error Classification ---');
  assert.strictEqual(Scheduler.classifyError('Connection timed out after 5000ms'), 'timeout');
  assert.strictEqual(Scheduler.classifyError('Permission Denied: Agent lacks capability'), 'permanent');
  assert.strictEqual(Scheduler.classifyError('Target provider unavailable'), 'provider_unavailable');
  assert.strictEqual(Scheduler.classifyError('Temporary socket congestion'), 'transient');
  console.log('✓ Smart retries error classification verified');

  console.log('\n====================================================');
  console.log('ALL PHASE 3B ADVANCED INTELLIGENCE TESTS PASSED 100%!');
  console.log('====================================================\n');
}

if (process.argv[1]?.endsWith('phase3b.test.ts')) {
  runPhase3bTests().catch((err) => {
    console.error('Phase 3B test failure:', err);
    process.exit(1);
  });
}
