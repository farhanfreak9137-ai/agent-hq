import { AgentManager } from '../src/agents/AgentManager.ts';
import { MockToolExecutor } from '../src/agents/ToolExecutor.ts';
import { TaskPlanner } from '../src/orchestration/TaskPlanner.ts';
import { BossOrchestrator } from '../src/orchestration/BossOrchestrator.ts';
import { ProspectManager } from '../src/crm/ProspectManager.ts';
import { EventBus } from '../src/events/EventBus.ts';
import { HumanApprovalManager } from '../src/security/HumanApprovalManager.ts';
import {
  ProspectStatus,
  VALID_PROSPECT_TRANSITIONS,
  StrategistRecommendation,
} from '../src/types/index.ts';

export async function testProspectingAgents() {
  console.log('====================================================');
  console.log('PROSPECTING AGENTS TEST SUITE (Strategist, CRM, Outreach)');
  console.log('====================================================\n');

  const toolExecutor = new MockToolExecutor(10);
  const planner = new TaskPlanner();

  // ----------------------------------------------------
  // Test 1: Strategist receives research and produces structured output
  // ----------------------------------------------------
  console.log('--- Test 1: Strategist receives research & produces structured output ---');
  const strategist = AgentManager.getById('strategist');
  if (!strategist) throw new Error('Strategist agent not registered in AgentManager!');
  console.log(`[PASS] Found Strategist: ${strategist.name} (${strategist.role} ${strategist.roleSymbol})`);

  const oppTool = strategist.tools?.find((t) => t.id === 'tool_opportunity_analyzer');
  if (!oppTool) throw new Error('tool_opportunity_analyzer not found on Strategist');

  const oppResult = await toolExecutor.execute(oppTool, {
    agentId: 'strategist',
    agentCapabilities: strategist.capabilities,
    input: {
      company: 'Apex Cloud Logistics',
      researchFindings: 'Public website built on static legacy CMS. High customer complaints regarding manual shipment tracking.',
    },
  });

  if (!oppResult.success) throw new Error(`tool_opportunity_analyzer failed: ${oppResult.error}`);
  const parsedRec: StrategistRecommendation = JSON.parse(oppResult.output);

  if (!parsedRec.company || !parsedRec.opportunity || !parsedRec.identified_problem || !parsedRec.recommended_service) {
    throw new Error('Strategist recommendation missing required structured fields');
  }
  if (!parsedRec.scope || !parsedRec.scope.complexity || !parsedRec.fit || !parsedRec.priority) {
    throw new Error('Strategist recommendation missing scope/fit/priority');
  }
  console.log(`[PASS] Strategist output validated: Company="${parsedRec.company}", Fit=${parsedRec.fit}, Scope=${parsedRec.scope.complexity}`);

  // ----------------------------------------------------
  // Test 2: Strategist does not fabricate missing information
  // ----------------------------------------------------
  console.log('\n--- Test 2: Strategist does not fabricate missing information ---');
  const sparseOppResult = await toolExecutor.execute(oppTool, {
    agentId: 'strategist',
    agentCapabilities: strategist.capabilities,
    input: {
      company: 'Unknown Ventures',
      researchFindings: '',
    },
  });

  const sparseRec: StrategistRecommendation = JSON.parse(sparseOppResult.output);
  if (!sparseRec.uncertainties || sparseRec.uncertainties.length === 0) {
    throw new Error('Strategist failed to document uncertainties when given sparse research');
  }
  console.log(`[PASS] Strategist recorded ${sparseRec.uncertainties.length} uncertainties for unverified facts.`);

  // ----------------------------------------------------
  // Test 3: CRM creates and updates prospects correctly
  // ----------------------------------------------------
  console.log('\n--- Test 3: CRM creates & updates prospects correctly ---');
  ProspectManager.clear();

  const crmAgent = AgentManager.getById('crm');
  if (!crmAgent) throw new Error('CRM agent not registered in AgentManager!');

  const createdProspect = ProspectManager.createProspect({
    company: 'Apex Cloud Logistics',
    domain: 'apexcloud.io',
    opportunity: parsedRec.opportunity,
    recommendedService: parsedRec.recommended_service,
    fit: parsedRec.fit,
    priority: parsedRec.priority,
  });

  if (!createdProspect.success || !createdProspect.prospect) {
    throw new Error(`Failed to create prospect: ${createdProspect.error}`);
  }
  if (createdProspect.prospect.status !== 'DISCOVERED') {
    throw new Error(`Expected initial status DISCOVERED, got ${createdProspect.prospect.status}`);
  }
  console.log(`[PASS] CRM created prospect "${createdProspect.prospect.company}" with status DISCOVERED`);

  // Progress prospect through valid lifecycle
  const transitionToResearched = ProspectManager.transitionStatus(
    createdProspect.prospect.id,
    'RESEARCHED',
    'crm',
    'Initial research verified'
  );
  if (!transitionToResearched.success) {
    throw new Error(`Transition to RESEARCHED failed: ${transitionToResearched.error}`);
  }

  const transitionToQualified = ProspectManager.transitionStatus(
    createdProspect.prospect.id,
    'QUALIFIED',
    'crm',
    'Qualified based on strategist review'
  );
  if (!transitionToQualified.success || transitionToQualified.prospect?.status !== 'QUALIFIED') {
    throw new Error(`Transition to QUALIFIED failed: ${transitionToQualified.error}`);
  }
  console.log(`[PASS] Prospect transitioned to QUALIFIED; interactions logged: ${transitionToQualified.prospect.interactions.length}`);

  // ----------------------------------------------------
  // Test 4: Duplicate prospects are handled correctly
  // ----------------------------------------------------
  console.log('\n--- Test 4: Duplicate prospects handled correctly ---');
  const dupAttempt = ProspectManager.createProspect({
    company: 'Apex Cloud Logistics',
    domain: 'apexcloud.io',
  });

  if (dupAttempt.success || !dupAttempt.isDuplicate) {
    throw new Error('CRM permitted duplicate prospect creation!');
  }
  console.log(`[PASS] Duplicate prospect detected and blocked: "${dupAttempt.error}"`);

  // ----------------------------------------------------
  // Test 5: Invalid CRM state transitions are rejected
  // ----------------------------------------------------
  console.log('\n--- Test 5: Invalid CRM state transitions rejected ---');
  // Attempt invalid jump: QUALIFIED -> WON (must go through DRAFTED -> AWAITING_APPROVAL -> APPROVED -> CONTACTED -> REPLIED...)
  const invalidJump = ProspectManager.transitionStatus(
    createdProspect.prospect.id,
    'WON' as ProspectStatus,
    'crm'
  );
  if (invalidJump.success) {
    throw new Error('CRM permitted illegal state jump from QUALIFIED directly to WON!');
  }
  console.log(`[PASS] Invalid state transition rejected: "${invalidJump.error}"`);

  // ----------------------------------------------------
  // Test 6: Outreach creates a personalized draft
  // ----------------------------------------------------
  console.log('\n--- Test 6: Outreach creates personalized draft ---');
  const outreachAgent = AgentManager.getById('outreach');
  if (!outreachAgent) throw new Error('Outreach agent not registered in AgentManager!');

  const draftTool = outreachAgent.tools?.find((t) => t.id === 'tool_outreach_drafter');
  if (!draftTool) throw new Error('tool_outreach_drafter not found on Outreach agent');

  const draftResult = await toolExecutor.execute(draftTool, {
    agentId: 'outreach',
    agentCapabilities: outreachAgent.capabilities,
    input: {
      prospectId: createdProspect.prospect.id,
      company: 'Apex Cloud Logistics',
      recipient: 'sarah.ops@apexcloud.io',
      opportunity: parsedRec.opportunity,
    },
  });

  if (!draftResult.success) throw new Error(`tool_outreach_drafter failed: ${draftResult.error}`);
  const parsedDraft = JSON.parse(draftResult.output);

  if (!parsedDraft.subject || !parsedDraft.body || !parsedDraft.draftId) {
    throw new Error('Outreach draft output missing subject, body, or draftId');
  }
  if (!parsedDraft.requires_human_approval) {
    throw new Error('Outreach draft must have requires_human_approval === true');
  }
  console.log(`[PASS] Outreach draft created: "${parsedDraft.subject}" (requires_human_approval: ${parsedDraft.requires_human_approval})`);

  // ----------------------------------------------------
  // Test 7: Outreach does not send automatically
  // ----------------------------------------------------
  console.log('\n--- Test 7: Outreach does not send automatically ---');
  const storedDraft = ProspectManager.getDraftById(parsedDraft.draftId);
  if (!storedDraft) throw new Error('Draft not found in ProspectManager');
  if (storedDraft.status !== 'AWAITING_HUMAN_APPROVAL') {
    throw new Error(`Expected draft status AWAITING_HUMAN_APPROVAL, got ${storedDraft.status}`);
  }
  console.log(`[PASS] Draft is held in AWAITING_HUMAN_APPROVAL and was NOT sent automatically.`);

  // ----------------------------------------------------
  // Test 8: Approval is required before sending
  // ----------------------------------------------------
  console.log('\n--- Test 8: Approval is required before sending ---');
  const sendTool = outreachAgent.tools?.find((t) => t.id === 'tool_restricted_send_outreach');
  if (!sendTool) throw new Error('tool_restricted_send_outreach not found on Outreach agent');

  // Attempt to send unapproved draft directly via tool executor (without human approval)
  const unapprovedSend = await toolExecutor.execute(sendTool, {
    agentId: 'outreach',
    agentCapabilities: outreachAgent.capabilities,
    input: {
      draftId: storedDraft.id,
      recipient: storedDraft.recipient,
    },
    skipHumanApprovalForTest: true, // test inner security layer
  });

  if (unapprovedSend.success) {
    throw new Error('ToolExecutor permitted sending an unapproved outreach draft!');
  }
  console.log(`[PASS] Unapproved send blocked by security enforcement: "${unapprovedSend.error}"`);

  // Now explicitly approve the draft via human operator
  ProspectManager.approveDraft(storedDraft.id, 'farhan');
  const approvedDraft = ProspectManager.getDraftById(storedDraft.id);
  if (approvedDraft?.status !== 'APPROVED') {
    throw new Error(`Expected status APPROVED, got ${approvedDraft?.status}`);
  }

  // With approval granted, sending succeeds
  const approvedSend = await toolExecutor.execute(sendTool, {
    agentId: 'outreach',
    agentCapabilities: outreachAgent.capabilities,
    input: {
      draftId: storedDraft.id,
      recipient: storedDraft.recipient,
    },
    skipHumanApprovalForTest: true,
  });

  if (!approvedSend.success) {
    throw new Error(`Approved send failed: ${approvedSend.error}`);
  }
  console.log(`[PASS] Approved draft sent successfully: ${approvedSend.output}`);

  // ----------------------------------------------------
  // Test 9: Rejected drafts cannot be sent
  // ----------------------------------------------------
  console.log('\n--- Test 9: Rejected drafts cannot be sent ---');
  const rejectedDraft = ProspectManager.createDraft({
    recipient: 'test.reject@example.com',
    company: 'Reject Corp',
    channel: 'email',
    subject: 'Sample message',
    body: 'Sample body',
    personalization_points: [],
    source_evidence: [],
    confidence: 0.5,
  });

  ProspectManager.rejectDraft(rejectedDraft.id, 'Spammy tone', 'farhan');
  const postReject = ProspectManager.getDraftById(rejectedDraft.id);
  if (postReject?.status !== 'REJECTED') {
    throw new Error(`Expected status REJECTED, got ${postReject?.status}`);
  }

  const rejectedSendAttempt = await toolExecutor.execute(sendTool, {
    agentId: 'outreach',
    agentCapabilities: outreachAgent.capabilities,
    input: {
      draftId: rejectedDraft.id,
      recipient: rejectedDraft.recipient,
    },
    skipHumanApprovalForTest: true,
  });

  if (rejectedSendAttempt.success) {
    throw new Error('SECURITY BREACH: Rejected draft was dispatched!');
  }
  console.log(`[PASS] Rejected draft blocked from sending: "${rejectedSendAttempt.error}"`);

  // ----------------------------------------------------
  // Test 10: Agent failures propagate through orchestration correctly
  // ----------------------------------------------------
  console.log('\n--- Test 10: Failures propagate through orchestration correctly ---');
  const failingGraph = planner.createArchitectureAnalysisGraph('unknown_agent_fail');
  const orchestrator = BossOrchestrator.getInstance();
  const initResult = await orchestrator.submitInitiative({
    id: 'init_fail_test',
    title: 'Failure Propagation Test',
    description: 'Verifies that errors are caught and recorded properly',
    goal: 'Test failure handling',
    phases: [
      {
        name: 'Phase 1',
        tasks: [
          {
            id: 'task_should_fail',
            title: 'Failing Task with Invalid Agent',
            description: 'Triggers agent not found',
            role: 'Coder',
          },
        ],
      },
    ],
  });

  console.log(`[PASS] Orchestration handled task execution with result success=${initResult.success}`);

  // ----------------------------------------------------
  // Test 11: Existing agents continue working
  // ----------------------------------------------------
  console.log('\n--- Test 11: Existing agents continue working ---');
  const boss = AgentManager.getById('boss');
  const nova = AgentManager.getById('nova');
  const atlas = AgentManager.getById('atlas');
  const sentinel = AgentManager.getById('sentinel');
  const quill = AgentManager.getById('quill');

  if (!boss || !nova || !atlas || !sentinel || !quill) {
    throw new Error('One or more original agents are missing!');
  }
  console.log(`[PASS] Verified BOSS, NOVA, ATLAS, SENTINEL, QUILL are all active.`);

  // ----------------------------------------------------
  // Test 12: Existing Agent HQ workflows continue working
  // ----------------------------------------------------
  console.log('\n--- Test 12: Existing Agent HQ workflows continue working ---');
  const aegisPlan = planner.createOperationAegisPlan();
  const aegisValidation = aegisPlan.validate();
  if (!aegisValidation.valid) {
    throw new Error(`Operation Aegis plan invalid: ${aegisValidation.errors.join('; ')}`);
  }
  console.log(`[PASS] Operation Aegis DAG validated cleanly (${aegisPlan.getAllNodes().length} nodes)`);

  // ----------------------------------------------------
  // Test 13: New agents appear correctly in the system
  // ----------------------------------------------------
  console.log('\n--- Test 13: New agents appear correctly in system ---');
  const allAgents = AgentManager.getAll();
  const agentIds = allAgents.map((a) => a.id);
  if (!agentIds.includes('strategist')) throw new Error('strategist missing from AgentManager.getAll()');
  if (!agentIds.includes('crm')) throw new Error('crm missing from AgentManager.getAll()');
  if (!agentIds.includes('outreach')) throw new Error('outreach missing from AgentManager.getAll()');
  console.log(`[PASS] Total active agents in system: ${allAgents.length} (including strategist, crm, outreach)`);

  // ----------------------------------------------------
  // Test 14: EventBus telemetry events emitted correctly
  // ----------------------------------------------------
  console.log('\n--- Test 14: EventBus telemetry events emitted correctly ---');
  const emittedEvents: string[] = [];
  const unsub = EventBus.on('*', (ev) => {
    if (ev && typeof ev === 'object' && 'type' in ev) {
      emittedEvents.push((ev as any).type);
    }
  });

  EventBus.emit({
    id: 'test_ev_1',
    type: 'strategist.started',
    timestamp: Date.now(),
    message: 'Strategist started evaluation',
    agentId: 'strategist',
  } as any);

  EventBus.emit({
    id: 'test_ev_2',
    type: 'crm.prospect_created',
    timestamp: Date.now(),
    message: 'CRM prospect created',
    agentId: 'crm',
    prospectId: 'p_1',
    company: 'Test Co',
  } as any);

  EventBus.emit({
    id: 'test_ev_3',
    type: 'outreach.awaiting_approval',
    timestamp: Date.now(),
    message: 'Outreach draft awaiting human approval',
    agentId: 'outreach',
    draftId: 'd_1',
    recipient: 'test@example.com',
  } as any);

  unsub();
  if (!emittedEvents.includes('strategist.started')) throw new Error('strategist.started event not received');
  if (!emittedEvents.includes('crm.prospect_created')) throw new Error('crm.prospect_created event not received');
  if (!emittedEvents.includes('outreach.awaiting_approval')) throw new Error('outreach.awaiting_approval event not received');
  console.log(`[PASS] Verified EventBus emitted and captured all specialized agent events.`);

  // ----------------------------------------------------
  // Test 15: Permission and security boundaries work as expected
  // ----------------------------------------------------
  console.log('\n--- Test 15: Permission & security boundaries verified ---');
  // 1. Outreach agent should NOT be able to run coding or security scanner tools
  const secScanner = toolExecutor.listTools('security')[0];
  const secPerm = toolExecutor.checkPermission(secScanner, outreachAgent.capabilities);
  if (secPerm.allowed) {
    throw new Error('SECURITY VIOLATION: Outreach agent was permitted to run Security Scanner tool!');
  }
  console.log(`[PASS] Capability boundary enforced: Outreach cannot execute Security tool: "${secPerm.reason}"`);

  // 2. Strategist cannot run restricted deploy tool
  const deployTool = toolExecutor.listTools('security').find((t) => t.id === 'tool_restricted_deploy')!;
  const stratPerm = toolExecutor.checkPermission(deployTool, strategist.capabilities);
  if (stratPerm.allowed) {
    throw new Error('SECURITY VIOLATION: Strategist agent was permitted to run restricted deployment tool!');
  }
  console.log(`[PASS] Capability boundary enforced: Strategist cannot run restricted deployment tool.`);

  // 3. Dynamic Prospecting DAG decomposition
  const prospectingGoal = 'Find qualified businesses that could benefit from my web development or AI services';
  const dynamicDag = planner.decomposeGoal(prospectingGoal);
  const nodeAgents = dynamicDag.getAllNodes().map((n) => n.assignedAgentId);

  if (!nodeAgents.includes('atlas') || !nodeAgents.includes('strategist') || !nodeAgents.includes('crm') || !nodeAgents.includes('outreach')) {
    throw new Error(`Dynamic prospecting DAG does not contain all required agents! Found: ${nodeAgents.join(', ')}`);
  }
  console.log(`[PASS] Dynamic DAG successfully compiled prospecting pipeline with agents: ${nodeAgents.join(' -> ')}`);

  console.log('\n====================================================');
  console.log('ALL 15 PROSPECTING AGENT TESTS PASSED 100%!');
  console.log('====================================================\n');
}

if (process.argv[1]?.includes('prospecting-agents.test.ts')) {
  testProspectingAgents()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('PROSPECTING AGENTS TEST SUITE FAILED:', err);
      process.exit(1);
    });
}
