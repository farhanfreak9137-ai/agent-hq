import { ProfileManager } from '../src/profile/ProfileManager.ts';
import { OpportunityManager } from '../src/opportunity/OpportunityManager.ts';
import { ProfileRepository } from '../server/repositories/ProfileRepository.ts';
import { OpportunityRepository } from '../server/repositories/OpportunityRepository.ts';
import { JobApplicationRepository } from '../server/repositories/JobApplicationRepository.ts';
import { getDatabase } from '../server/db/database.ts';
import { seedDatabase } from '../server/db/migrations.ts';
import { AgentManager } from '../src/agents/AgentManager.ts';
import { MockToolExecutor } from '../src/agents/ToolExecutor.ts';
import { TaskPlanner } from '../src/orchestration/TaskPlanner.ts';
import { ProspectManager } from '../src/crm/ProspectManager.ts';
import { HumanApprovalManager } from '../src/security/HumanApprovalManager.ts';
import {
  Opportunity,
  OpportunityStatus,
  JobApplication,
  VALID_OPPORTUNITY_TRANSITIONS,
} from '../src/types/index.ts';

export async function testOpportunityAndProfileSuite() {
  console.log('====================================================');
  console.log('FARHAN PROFESSIONAL PROFILE & OPPORTUNITY HQ TEST SUITE');
  console.log('====================================================\n');

  const toolExecutor = new MockToolExecutor(10);
  const db = getDatabase({ inMemory: true });
  seedDatabase(db);
  const profileRepo = new ProfileRepository(db);
  const oppRepo = new OpportunityRepository(db);
  const appRepo = new JobApplicationRepository(db);

  // ----------------------------------------------------
  // Test 1: Farhan Professional Profile CRUD
  // ----------------------------------------------------
  console.log('--- Test 1: Farhan Professional Profile CRUD ---');
  const initialProfile = ProfileManager.getProfile('FULL');
  if (!initialProfile || (initialProfile.identity.fullName !== 'Md Farhan Hossain' && initialProfile.identity.fullName !== 'Farhan')) {
    throw new Error(`ProfileManager returned invalid initial profile: ${initialProfile?.identity?.fullName}`);
  }

  const updatedHeadline = 'Lead Autonomous Systems & AI Architect';
  const updatedRes = ProfileManager.updateProfile(
    {
      identity: {
        ...initialProfile.identity,
        professionalHeadline: updatedHeadline,
      },
    },
    true
  );
  if (!updatedRes.success || ProfileManager.getProfile('FULL').identity.professionalHeadline !== updatedHeadline) {
    throw new Error('ProfileManager failed to update authoritative profile');
  }

  // Verify SQLite WAL DB repository also performs CRUD
  const dbProfile = profileRepo.getProfile('FULL');
  if (!dbProfile || !dbProfile.identity) {
    throw new Error('ProfileRepository.getProfile failed against SQLite WAL DB');
  }
  const dbUpdate = profileRepo.updateProfile(
    { identity: { ...dbProfile.identity, professionalHeadline: updatedHeadline } },
    { isAuthoritativeUser: true, updatedBy: 'Farhan' }
  );
  if (!dbUpdate.success) {
    throw new Error(`ProfileRepository failed authoritative update: ${dbUpdate.error}`);
  }
  console.log(`[PASS] Professional Profile CRUD verified in memory and SQLite WAL DB. Headline: "${updatedHeadline}"`);

  // ----------------------------------------------------
  // Test 2: Profile Factual Integrity (Agents cannot silently mutate facts)
  // ----------------------------------------------------
  console.log('\n--- Test 2: Profile Factual Integrity Guard ---');
  let mutationBlocked = false;
  try {
    profileRepo.updateProfile(
      { identity: { ...dbProfile.identity, fullName: 'Impostor Agent' } },
      { isAuthoritativeUser: false, updatedBy: 'autonomous_agent' }
    );
  } catch (err: any) {
    if (err.message.includes('Agents cannot directly mutate authoritative profile data')) {
      mutationBlocked = true;
    }
  }
  if (!mutationBlocked) {
    throw new Error('SECURITY VIOLATION: Agent was able to mutate authoritative profile directly!');
  }

  const managerAgentUpdate = ProfileManager.updateProfile(
    { identity: { ...initialProfile.identity, fullName: 'Impostor Agent' } },
    false
  );
  if (managerAgentUpdate.success) {
    throw new Error('SECURITY VIOLATION: ProfileManager allowed agent direct mutation!');
  }
  console.log('[PASS] Direct agent mutation strictly rejected with authorization error across repo & manager.');

  // ----------------------------------------------------
  // Test 3: Public / Application-Only / Private Field Separation
  // ----------------------------------------------------
  console.log('\n--- Test 3: Field Visibility Separation (PUBLIC / APPLICATION / FULL) ---');
  const publicExport = ProfileManager.getExportableProfile('PUBLIC');
  if (publicExport.identity.email !== '[Protected Email]') {
    throw new Error(`SECURITY LEAK: Public export should protect email, got "${publicExport.identity.email}"`);
  }

  const appExport = ProfileManager.getExportableProfile('APPLICATION');
  if (!appExport.identity.email || appExport.identity.email === '[Protected Email]') {
    throw new Error('Application export should contain actual application email');
  }

  const fullExport = ProfileManager.getProfile('FULL');
  if (!fullExport.identity.email || !fullExport.identity.fullName) {
    throw new Error('Full export should contain all authoritative fields');
  }
  console.log('[PASS] Field visibility verified: Public and Application scopes securely filter private data.');

  // ----------------------------------------------------
  // Test 4: Profile Changes Require Authorization (Suggestion Queue)
  // ----------------------------------------------------
  console.log('\n--- Test 4: Agent Profile Suggestion & Approval Queue ---');
  const suggestion = ProfileManager.suggestChange({
    agentId: 'agent_scout',
    reason: 'Detected Rust systems codebase in local workspace benchmarks',
    section: 'skills',
    proposedChange: {
      category: 'languages',
      newSkills: ['Rust'],
      verified: true,
    },
  });
  if (!suggestion || suggestion.status !== 'PENDING') {
    throw new Error('Suggestion was not placed in PENDING state');
  }

  // Profile must not contain Rust yet
  if (ProfileManager.getProfile('FULL').skills.languages.includes('Rust')) {
    throw new Error('Profile was prematurely updated before human approval!');
  }

  // Farhan approves the suggestion
  const approvalRes = ProfileManager.approveSuggestion(suggestion.id, 'Farhan');
  if (!approvalRes.success || !ProfileManager.getProfile('FULL').skills.languages.includes('Rust')) {
    throw new Error('Profile did not receive approved skill after human authorization');
  }

  // Rejection test
  const badSuggestion = ProfileManager.suggestChange({
    agentId: 'agent_scout',
    reason: 'Agent hallucination',
    section: 'skills',
    proposedChange: {
      category: 'languages',
      newSkills: ['Cobol'],
      verified: false,
    },
  });
  ProfileManager.rejectSuggestion(badSuggestion.id, 'Farhan');
  if (ProfileManager.getProfile('FULL').skills.languages.includes('Cobol')) {
    throw new Error('Rejected suggestion was incorrectly applied to profile!');
  }
  console.log('[PASS] Agent suggestions queue verified: requires explicit human approval before touching profile.');

  // ----------------------------------------------------
  // Test 5: Opportunity Creation
  // ----------------------------------------------------
  console.log('\n--- Test 5: Opportunity Creation ---');
  const createOppRes = OpportunityManager.createOpportunity({
    title: 'Autonomous Multi-Agent Systems Engineer',
    organization: 'DeepMind Applied Research',
    type: 'job',
    source: 'Ecosystem Scout Agent',
    sourceUrl: 'https://careers.google.com/jobs/deepmind-applied-agentic-engineer',
    location: 'Remote / Hybrid',
    remote: true,
    description: 'Design and validate multi-agent orchestration architectures and tool workflows.',
    requirements: ['TypeScript', 'Multi-Agent Systems', 'Node.js', 'SQLite'],
    eligibility: ['Demonstrated experience in autonomous agents and LLM tool orchestration'],
    deadline: '2026-11-01',
  });

  if (!createOppRes.success || !createOppRes.opportunity || createOppRes.opportunity.status !== 'DISCOVERED') {
    throw new Error(`Opportunity creation failed: ${createOppRes.error}`);
  }
  const newOpp = createOppRes.opportunity;
  console.log(`[PASS] Opportunity created: ID=${newOpp.id}, Title="${newOpp.title}", Org="${newOpp.organization}"`);

  // ----------------------------------------------------
  // Test 6: Duplicate Opportunity Detection
  // ----------------------------------------------------
  console.log('\n--- Test 6: Duplicate Opportunity Detection ---');
  const duplicateByUrl = OpportunityManager.checkDuplicate(
    'Another Org',
    'Another Title',
    'https://careers.google.com/jobs/deepmind-applied-agentic-engineer'
  );
  if (!duplicateByUrl || duplicateByUrl.id !== newOpp.id) {
    throw new Error('Failed to detect duplicate opportunity by sourceUrl');
  }

  const duplicateByName = OpportunityManager.checkDuplicate(
    'DeepMind Applied Research',
    'Autonomous Multi-Agent Systems Engineer'
  );
  if (!duplicateByName || duplicateByName.id !== newOpp.id) {
    throw new Error('Failed to detect duplicate opportunity by (organization, title)');
  }

  // Repository duplicate detection test
  oppRepo.createOpportunity({
    id: 'opp_dup_initial',
    title: 'Autonomous Multi-Agent Systems Engineer',
    organization: 'DeepMind Applied Research',
    type: 'job',
    source: 'Test',
    sourceUrl: 'https://careers.google.com/jobs/deepmind-applied-agentic-engineer',
    requirements: ['TypeScript'],
  });

  let repoDupBlocked = false;
  try {
    oppRepo.createOpportunity({
      id: 'opp_dup_second',
      title: 'Autonomous Multi-Agent Systems Engineer',
      organization: 'DeepMind Applied Research',
      type: 'job',
      source: 'Test',
      sourceUrl: 'https://careers.google.com/jobs/deepmind-applied-agentic-engineer',
      requirements: ['TypeScript'],
    });
  } catch (err: any) {
    if (err.message.includes('Duplicate opportunity detected')) {
      repoDupBlocked = true;
    }
  }
  if (!repoDupBlocked) {
    throw new Error('OpportunityRepository failed to block duplicate entry!');
  }
  console.log('[PASS] Duplicate detection verified by sourceUrl and (organization, title) across memory and DB.');

  // ----------------------------------------------------
  // Test 7: Opportunity State Transitions
  // ----------------------------------------------------
  console.log('\n--- Test 7: Opportunity State Machine Transitions ---');
  // DISCOVERED -> REVIEWING
  const t1 = OpportunityManager.transitionStatus(newOpp.id, 'REVIEWING', 'scout', 'Reviewing requirements');
  if (!t1.success) throw new Error(`Transition DISCOVERED -> REVIEWING failed: ${t1.error}`);

  // REVIEWING -> QUALIFIED
  const t2 = OpportunityManager.transitionStatus(newOpp.id, 'QUALIFIED', 'strategist', 'Requirements verified');
  if (!t2.success) throw new Error(`Transition REVIEWING -> QUALIFIED failed: ${t2.error}`);

  // QUALIFIED -> SUBMITTED directly should FAIL
  const invalidTransition = OpportunityManager.transitionStatus(newOpp.id, 'SUBMITTED', 'illegal', 'Illegal jump');
  if (invalidTransition.success) {
    throw new Error('State machine allowed illegal transition QUALIFIED -> SUBMITTED without draft & approval!');
  }
  console.log(`[PASS] State machine enforced: Invalid transition blocked (${invalidTransition.error})`);

  // ----------------------------------------------------
  // Test 8: Transparent Requirement Matching (No political / arbitrary score)
  // ----------------------------------------------------
  console.log('\n--- Test 8: Transparent Requirement Matching & Evidence Math ---');
  const matchResult = OpportunityManager.matchOpportunity(newOpp.id);
  if (!matchResult.success || !matchResult.fitAnalysis) {
    throw new Error(`Failed to compute fit analysis: ${matchResult.error}`);
  }
  const fitAnalysis = matchResult.fitAnalysis;

  // Farhan's profile has all 4 skills: ['TypeScript', 'Multi-Agent Systems', 'Node.js', 'SQLite']
  if (fitAnalysis.matchPercentage !== 100) {
    throw new Error(`Expected 100% transparent match for Farhan's exact skills, got ${fitAnalysis.matchPercentage}%`);
  }
  if (fitAnalysis.potentialGaps.length !== 0) {
    throw new Error(`Expected 0 gaps, got: ${fitAnalysis.potentialGaps.join(', ')}`);
  }
  if (fitAnalysis.evidence.length === 0) {
    throw new Error('Fit analysis did not provide specific project evidence links');
  }

  // Test partial match calculation math (3 out of 5 = 60%)
  const partialCreate = OpportunityManager.createOpportunity({
    title: 'Distributed Rust & Erlang Cloud Engineer',
    organization: 'High-Concurrency Systems',
    type: 'job',
    source: 'Tech Board',
    sourceUrl: 'https://jobs.tech/rust-erlang-cloud',
    requirements: ['TypeScript', 'React', 'Node.js', 'Erlang', 'Haskell'],
  });
  const partialOpp = partialCreate.opportunity!;
  const partialMatch = OpportunityManager.matchOpportunity(partialOpp.id);
  const partialFit = partialMatch.fitAnalysis!;
  // Matches: TypeScript, React, Node.js (3). Missing: Erlang, Haskell (2).
  // 3 / 5 = 60%
  if (partialFit.matchPercentage !== 60) {
    throw new Error(`Expected transparent mathematical match of 60% (3/5), got ${partialFit.matchPercentage}%`);
  }
  if (!partialFit.potentialGaps.includes('Erlang') || !partialFit.potentialGaps.includes('Haskell')) {
    throw new Error('Potential gaps must transparently identify unverified requirements');
  }
  console.log(`[PASS] Transparent math verified: 3/5 matched = ${partialFit.matchPercentage}%, Gaps: ${partialFit.potentialGaps.join(', ')}`);

  // ----------------------------------------------------
  // Test 9: No Fabricated Profile Facts
  // ----------------------------------------------------
  console.log('\n--- Test 9: Profile Anti-Fabrication Fact Checker ---');
  const validVerification = ProfileManager.verifyFactualAccuracy({
    skills: ['TypeScript', 'React', 'Multi-Agent Systems'],
    projects: ['Agent HQ'],
  });
  if (!validVerification.valid) {
    throw new Error(`Valid claims were flagged incorrectly: ${validVerification.unverifiedItems.join(', ')}`);
  }

  const hallucinatedVerification = ProfileManager.verifyFactualAccuracy({
    skills: ['Quantum Computing Qiskit', 'Cobol Architecture'],
    projects: ['Secret NASA Space Station Flight Control System'],
  });
  if (hallucinatedVerification.valid) {
    throw new Error('Anti-fabrication checker failed to catch hallucinated skills and projects!');
  }
  if (hallucinatedVerification.unverifiedItems.length < 3) {
    throw new Error('unverifiedItems did not report all hallucinated items');
  }
  console.log(`[PASS] Anti-fabrication fact checker caught ${hallucinatedVerification.unverifiedItems.length} unverified claims.`);

  // ----------------------------------------------------
  // Test 10: No Fabricated Opportunity Facts
  // ----------------------------------------------------
  console.log('\n--- Test 10: Opportunity Requirement Verification Guard ---');
  // When an opportunity requirement is unknown or missing, it must be flagged as unverified gap rather than assumed
  if (!partialFit.potentialGaps.includes('Haskell')) {
    throw new Error('Missing requirement was not flagged as unverified');
  }
  console.log('[PASS] Unverified opportunity requirements are explicitly classified as gaps.');

  // ----------------------------------------------------
  // Test 11: Resume Customization Uses Only Verified Profile Information
  // ----------------------------------------------------
  console.log('\n--- Test 11: Resume Customization Grounded in Authoritative Profile ---');
  const resumeResult = await toolExecutor.execute(
    AgentManager.getById('strategist')!.tools!.find((t) => t.id === 'tool_resume_customizer')!,
    {
      agentId: 'strategist',
      agentCapabilities: ['strategy', 'analysis', 'research'],
      input: {
        opportunityId: newOpp.id,
      },
    }
  );
  if (!resumeResult.success) throw new Error(`tool_resume_customizer failed: ${resumeResult.error}`);
  const tailoredResume = JSON.parse(resumeResult.output);
  if (!tailoredResume.tailoredSummary || !tailoredResume.skillsHighlighted) {
    throw new Error('Tailored resume missing summary or highlighted skills');
  }
  // Ensure highlighted skills are actual skills of Farhan
  const allVerified = ProfileManager.getProfile('FULL').skills.verifiedSkills;
  for (const skill of tailoredResume.skillsHighlighted) {
    const isKnown = allVerified.some((s) => s.toLowerCase() === skill.toLowerCase());
    if (!isKnown) {
      throw new Error(`Resume customizer fabricated unverified skill: ${skill}`);
    }
  }
  console.log(`[PASS] Resume customized with verified skills only: [${tailoredResume.skillsHighlighted.join(', ')}]`);

  // ----------------------------------------------------
  // Test 12: Application Draft Generation
  // ----------------------------------------------------
  console.log('\n--- Test 12: Application Draft Generation ---');
  const draftRes = OpportunityManager.tailorResumeAndDraft(newOpp.id);
  if (!draftRes.success || !draftRes.application) {
    throw new Error(`Failed to generate application draft: ${draftRes.error}`);
  }
  const app = draftRes.application;
  if (!app.coverLetter || !app.tailoredResume || app.status !== 'AWAITING_APPROVAL') {
    throw new Error('Generated application is incomplete or not in AWAITING_APPROVAL state');
  }
  console.log(`[PASS] Application draft generated: AppID=${app.id}, Status="${app.status}"`);

  // ----------------------------------------------------
  // Test 13: Application Approval Requirement (Cannot submit while unapproved)
  // ----------------------------------------------------
  console.log('\n--- Test 13: Application Submission Blocked When Unapproved ---');
  const earlySubmit = OpportunityManager.submitApplication(app.id);
  if (earlySubmit.success) {
    throw new Error('SECURITY VIOLATION: Application submitted without Farhan approval!');
  }
  if (!earlySubmit.error?.includes('SECURITY ENFORCEMENT ERROR')) {
    throw new Error(`Expected SECURITY ENFORCEMENT ERROR, got: ${earlySubmit.error}`);
  }
  console.log(`[PASS] Unapproved submission blocked as required: ${earlySubmit.error}`);

  // ----------------------------------------------------
  // Test 14: Rejected Application Cannot Submit
  // ----------------------------------------------------
  console.log('\n--- Test 14: Rejected Application Cannot Submit ---');
  const rejectRes = OpportunityManager.rejectApplication(app.id, 'Focusing on core research first', 'Farhan');
  if (!rejectRes.success || rejectRes.application?.status !== 'REJECTED') {
    throw new Error('Failed to reject application');
  }
  const rejectedSubmit = OpportunityManager.submitApplication(app.id);
  if (rejectedSubmit.success) {
    throw new Error('SECURITY VIOLATION: Rejected application was allowed to submit!');
  }
  console.log(`[PASS] Rejected application blocked from submission: ${rejectedSubmit.error}`);

  // ----------------------------------------------------
  // Test 15: External Submission Cannot Bypass Approval Gate
  // ----------------------------------------------------
  console.log('\n--- Test 15: Approval Gate Allows Submission ONLY After Farhan Approval ---');
  // Draft a fresh application for DeepMind
  const freshDraft = OpportunityManager.tailorResumeAndDraft(newOpp.id);
  const freshApp = freshDraft.application!;

  // Try submitting via restricted tool before approval -> MUST FAIL
  const submitTool = AgentManager.getById('outreach')!.tools!.find(
    (t) => t.id === 'tool_restricted_submit_application'
  )!;
  const prematureToolSubmit = await toolExecutor.execute(submitTool, {
    agentId: 'outreach',
    agentCapabilities: ['outreach', 'email', 'communication'],
    input: { applicationId: freshApp.id },
    skipHumanApprovalForTest: true,
  });
  if (prematureToolSubmit.success) {
    throw new Error('SECURITY VIOLATION: tool_restricted_submit_application bypassed human approval!');
  }
  console.log(`[PASS] Tool submission before approval rejected: ${prematureToolSubmit.error}`);

  // Farhan explicitly approves
  const approveRes = OpportunityManager.approveApplication(freshApp.id, 'Farhan');
  if (!approveRes.success || approveRes.application?.status !== 'APPROVED') {
    throw new Error(`Failed to approve application: ${approveRes.error}`);
  }

  // Now submission succeeds
  const authorizedSubmit = OpportunityManager.submitApplication(freshApp.id);
  if (!authorizedSubmit.success || authorizedSubmit.application?.status !== 'SUBMITTED') {
    throw new Error(`Authorized submission failed: ${authorizedSubmit.error}`);
  }
  console.log(`[PASS] Authorized submission succeeded: App status="${authorizedSubmit.application?.status}"`);

  // ----------------------------------------------------
  // Test 16: Existing Strategist Continues Working
  // ----------------------------------------------------
  console.log('\n--- Test 16: Existing Strategist Agent Unaffected ---');
  const strategist = AgentManager.getById('strategist');
  if (!strategist) throw new Error('Strategist agent missing!');
  const stratTool = strategist.tools?.find((t) => t.id === 'tool_opportunity_analyzer');
  if (!stratTool) throw new Error('tool_opportunity_analyzer missing from Strategist');

  const stratRun = await toolExecutor.execute(stratTool, {
    agentId: 'strategist',
    agentCapabilities: strategist.capabilities,
    input: {
      company: 'Omni Retail Group',
      researchFindings: 'E-commerce platform with manual stock reconciliation issues.',
    },
  });
  if (!stratRun.success) throw new Error(`Existing Strategist tool failed: ${stratRun.error}`);
  console.log('[PASS] Existing Strategist tool execution continues working seamlessly.');

  // ----------------------------------------------------
  // Test 17: Existing CRM Continues Working
  // ----------------------------------------------------
  console.log('\n--- Test 17: Existing CRM Pipeline Unaffected ---');
  const prospectRes = ProspectManager.createProspect({
    company: 'Quantum Logistics Systems',
    domain: 'quantumlogistics.test',
  });
  if (!prospectRes.success || !prospectRes.prospect || prospectRes.prospect.status !== 'DISCOVERED') {
    throw new Error('ProspectManager failed to create prospect');
  }
  const crmTrans = ProspectManager.transitionStatus(
    prospectRes.prospect.id,
    'RESEARCHED',
    'crm',
    'Assigned to Atlas'
  );
  if (!crmTrans.success) {
    throw new Error(`ProspectManager failed transition: ${crmTrans.error}`);
  }
  console.log('[PASS] Existing CRM prospect pipeline continues working without regression.');

  // ----------------------------------------------------
  // Test 18: Existing Outreach Continues Working
  // ----------------------------------------------------
  console.log('\n--- Test 18: Existing Outreach Agent & Approvals Unaffected ---');
  const outreach = AgentManager.getById('outreach');
  if (!outreach) throw new Error('Outreach agent missing!');
  const emailTool = outreach.tools?.find((t) => t.id === 'tool_outreach_drafter');
  if (!emailTool) throw new Error('tool_outreach_drafter missing from Outreach');

  const emailRun = await toolExecutor.execute(emailTool, {
    agentId: 'outreach',
    agentCapabilities: outreach.capabilities,
    input: {
      company: 'Quantum Logistics Systems',
      recipient: 'sconnor@quantumlogistics.test',
      recommendedService: 'Automated Agent Orchestration',
    },
  });
  if (!emailRun.success) throw new Error(`tool_outreach_drafter failed: ${emailRun.error}`);
  console.log('[PASS] Existing Outreach generator continues working as expected.');

  // ----------------------------------------------------
  // Test 19: Existing DAG Workflows Continue Working
  // ----------------------------------------------------
  console.log('\n--- Test 19: Existing DAG Planning Unaffected & Opportunity DAG Available ---');
  const planner = new TaskPlanner();

  // 19A: Prospecting goal decomposes to atlas -> strategist -> crm -> outreach
  const prospectingGraph = planner.decomposeGoal('Find qualified business clients for AI workflow automation');
  const prospectingNodes = prospectingGraph.getAllNodes();
  const prospectingAgents = prospectingNodes.map((p) => p.assignedAgentId);
  if (
    !prospectingAgents.includes('atlas') ||
    !prospectingAgents.includes('strategist') ||
    !prospectingAgents.includes('crm') ||
    !prospectingAgents.includes('outreach')
  ) {
    throw new Error(`Prospecting goal did not produce expected DAG pipeline: ${prospectingAgents.join(', ')}`);
  }

  // 19B: Career opportunity goal decomposes to opportunity pipeline
  const careerGraph = planner.decomposeGoal('Find software engineering internship and apply for opportunities');
  const careerNodes = careerGraph.getAllNodes();
  const careerRoles = careerNodes.map((p) => p.title);
  if (!careerRoles.some((t) => t.toLowerCase().includes('opportunity') || t.toLowerCase().includes('application'))) {
    throw new Error(`Career goal did not produce opportunity pipeline: ${careerRoles.join(', ')}`);
  }
  console.log('[PASS] Both prospecting and career opportunity DAG pipelines compile correctly.');

  // ----------------------------------------------------
  // Test 20: Existing Security Tests Pass Intact
  // ----------------------------------------------------
  console.log('\n--- Test 20: Human Approval Security Core Intact ---');
  const approvalMgr = HumanApprovalManager.getInstance();
  const requestPromise = approvalMgr.requestApproval({
    taskId: 'test_security_task',
    agentId: 'outreach',
    toolId: 'tool_restricted_submit_application',
    toolName: 'External Application Dispatcher',
    reason: 'Testing approval security gate',
  });

  const pendingRequests = approvalMgr.getPendingRequests();
  if (pendingRequests.length === 0) {
    throw new Error('HumanApprovalManager failed to record approval request');
  }

  const targetReq = pendingRequests[0];
  approvalMgr.reject(targetReq.id, 'Farhan', 'Denied by security test');
  const result = await requestPromise;
  if (result.approved) {
    throw new Error('Approval request should have been rejected!');
  }
  console.log('[PASS] Human approval security gate operating with full integrity.');

  // ----------------------------------------------------
  // ----------------------------------------------------
  // Test 21: Authoritative USER_CONFIRMED Profile Verification
  // ----------------------------------------------------
  console.log('\n--- Test 21: Authoritative USER_CONFIRMED Profile Verification ---');
  const auditedProfile = ProfileManager.getProfile('FULL');

  // 21A: Identity & Basic Details
  if (auditedProfile.identity.fullName !== 'Md Farhan Hossain' || auditedProfile.identity.professionalName !== 'Farhan') {
    throw new Error(`Identity mismatch: fullName=${auditedProfile.identity.fullName}, professionalName=${auditedProfile.identity.professionalName}`);
  }
  if (!auditedProfile.identity.portfolioUrl.includes('portfolio-two-chi-dgvbedq05m.vercel.app')) {
    throw new Error('Portfolio URL mismatch');
  }
  if (!auditedProfile.identity.githubUrl.includes('github.com/farhanfreak9137-ai')) {
    throw new Error('GitHub URL mismatch');
  }

  // 21B: Education appears correctly (No university degree, HSC 2nd Year Science student)
  if (auditedProfile.education.length === 0) {
    throw new Error('Education must be populated');
  }
  const edu = auditedProfile.education[0];
  if (edu.institution !== 'Pallabi Government College') {
    throw new Error(`Expected institution Pallabi Government College, got: ${edu.institution}`);
  }
  if (edu.level !== 'HSC 2nd Year' || edu.stream !== 'Science' || edu.expectedGraduation !== '2027') {
    throw new Error(`Expected HSC 2nd Year Science (2027), got: level=${edu.level}, stream=${edu.stream}, expectedGraduation=${edu.expectedGraduation}`);
  }
  if (edu.previousCollege !== 'Milestone College') {
    throw new Error(`Expected previous college Milestone College, got: ${edu.previousCollege}`);
  }
  if (edu.sscInstitution !== 'Mdc Model School and College' || edu.sscYear !== '2025' || edu.sscGpa !== '4.11') {
    throw new Error(`Expected SSC at Mdc Model (2025, GPA 4.11), got: ${edu.sscInstitution}, ${edu.sscYear}, ${edu.sscGpa}`);
  }
  if (!edu.verified || edu.provenance !== 'USER_CONFIRMED') {
    throw new Error(`Education must be verified with USER_CONFIRMED provenance, got: verified=${edu.verified}, prov=${edu.provenance}`);
  }
  if ('degree' in edu && (edu as any).degree && (edu as any).degree.length > 0) {
    throw new Error(`CRITICAL: University degree must NOT be present! Found degree: "${(edu as any).degree}"`);
  }
  if (edu.academicHistory.toLowerCase().includes('university') || edu.academicHistory.toLowerCase().includes('bachelor')) {
    throw new Error('Academic history contains prohibited university or bachelor terms!');
  }

  // 21C: Shwapno work experience appears correctly (Retail Checkout Assistant, zero tech duties)
  if (auditedProfile.experience.length !== 1) {
    throw new Error(`Expected exactly 1 experience record (Shwapno), got: ${auditedProfile.experience.length}`);
  }
  const shwapno = auditedProfile.experience[0];
  if (shwapno.organization !== 'Shwapno' || shwapno.role !== 'Checkout Assistant / POS Cashier') {
    throw new Error(`Expected Shwapno Checkout Assistant, got: ${shwapno.organization} - ${shwapno.role}`);
  }
  if (shwapno.startDate !== '2025-07-30' || shwapno.endDate !== '2025-12-20') {
    throw new Error(`Expected 2025-07-30 – 2025-12-20 (July 30, 2025 – December 20, 2025), got: ${shwapno.startDate} – ${shwapno.endDate}`);
  }
  if (!shwapno.reasonForLeaving?.includes('academic improvement')) {
    throw new Error(`Expected reason for leaving focusing on academic improvement, got: ${shwapno.reasonForLeaving}`);
  }
  if (!shwapno.verified || shwapno.provenance !== 'USER_CONFIRMED') {
    throw new Error('Shwapno experience must be verified with USER_CONFIRMED provenance');
  }
  if (shwapno.description.toLowerCase().includes('software') || shwapno.description.toLowerCase().includes('developer')) {
    throw new Error('Shwapno experience contains prohibited software development claims!');
  }

  // 21D: All 5 projects are included as personal/student projects
  const expectedProjects = ['Agent HQ', 'Auren', 'HSC AI Study Intelligence System', 'Atlas', 'Gym Tracker'];
  for (const name of expectedProjects) {
    const proj = auditedProfile.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!proj) throw new Error(`Required project "${name}" is missing from profile!`);
    if (!proj.verified || proj.provenance !== 'USER_CONFIRMED') {
      throw new Error(`Project "${name}" must be verified with USER_CONFIRMED provenance`);
    }
  }

  const aurenProj = auditedProfile.projects.find((p) => p.name === 'Auren')!;
  if (aurenProj.description.toLowerCase().includes('enterprise product') || aurenProj.description.toLowerCase().includes('commercial users')) {
    throw new Error('Project Auren contains prohibited enterprise/commercial claims!');
  }

  const hscProj = auditedProfile.projects.find((p) => p.name.includes('HSC AI'))!;
  if (hscProj.description.toLowerCase().includes('institutional adoption') || hscProj.description.toLowerCase().includes('revenue')) {
    throw new Error('HSC AI Study system contains prohibited adoption/revenue claims!');
  }

  const atlasProj = auditedProfile.projects.find((p) => p.name === 'Atlas')!;
  if (atlasProj.description.toLowerCase().includes('enterprise') || atlasProj.description.toLowerCase().includes('revenue')) {
    throw new Error('Atlas contains prohibited revenue claims!');
  }

  // 21E: Fact checker validates all 5 projects
  const allProjectsVerified = ProfileManager.verifyFactualAccuracy({
    projects: expectedProjects,
  });
  if (!allProjectsVerified.valid) {
    throw new Error(`Fact checker rejected confirmed projects: ${allProjectsVerified.unverifiedItems.join(', ')}`);
  }

  // 21F: Zero certifications or achievements invented
  if (auditedProfile.certifications.length !== 0) {
    throw new Error(`Certifications must be empty, found: ${auditedProfile.certifications.length}`);
  }
  if (auditedProfile.achievements.length !== 0) {
    throw new Error(`Achievements must be empty, found: ${auditedProfile.achievements.length}`);
  }

  // 21G: Services offered are strictly service offerings, not client claims
  if (!auditedProfile.services?.otherApprovedServices || auditedProfile.services.otherApprovedServices.length !== 6) {
    throw new Error(`Expected exactly 6 services offered, got: ${auditedProfile.services?.otherApprovedServices?.length}`);
  }
  console.log('[PASS] All authoritative USER_CONFIRMED profile facts verified with zero embellishments.');

  // ----------------------------------------------------
  // Test 22: Demo Opportunities Are Clearly Marked
  // ----------------------------------------------------
  console.log('\n--- Test 22: Demo Opportunities Are Clearly Marked ---');
  const allOpps = OpportunityManager.getAllOpportunities();
  const seededIds = ['opp_seed_1', 'opp_seed_2', 'opp_seed_3'];
  for (const id of seededIds) {
    const opp = allOpps.find((o) => o.id === id);
    if (!opp) throw new Error(`Seeded opportunity ${id} not found`);
    if (opp.sourceVerification !== 'DEMO') {
      throw new Error(`Seeded opportunity ${id} has sourceVerification '${opp.sourceVerification}', expected 'DEMO'`);
    }
  }

  // Database rows must also reflect DEMO status
  const dbOpps = oppRepo.findAll();
  for (const id of seededIds) {
    const dbOpp = dbOpps.find((o) => o.id === id);
    if (dbOpp && dbOpp.sourceVerification !== 'DEMO') {
      throw new Error(`Database seeded opportunity ${id} sourceVerification is '${dbOpp.sourceVerification}', expected 'DEMO'`);
    }
  }

  // Default new opportunity must be UNVERIFIED, never DEMO or VERIFIED by default
  const testNewOppRes = OpportunityManager.createOpportunity({
    title: 'Senior Systems Engineer',
    organization: 'Acme Robotics',
    type: 'job',
    location: 'Remote',
    remote: true,
    description: 'Autonomous systems role',
    requirements: ['Rust', 'Distributed Systems'],
    sourceUrl: 'https://example.com/jobs/1',
  });
  if (testNewOppRes.opportunity?.sourceVerification !== 'UNVERIFIED') {
    throw new Error(`Newly created opportunity should default to UNVERIFIED, got: ${testNewOppRes.opportunity?.sourceVerification}`);
  }
  console.log('[PASS] Seeded opportunities are explicitly marked DEMO and new opportunities default to UNVERIFIED.');

  // ----------------------------------------------------
  // Test 23: Agents Cannot Mutate Authoritative Facts Directly
  // ----------------------------------------------------
  console.log('\n--- Test 23: Agents Cannot Mutate Authoritative Facts Directly ---');
  // Attempt 1: Agent tries direct updateProfile
  const agentUpdateRes = ProfileManager.updateProfile(
    {
      education: [
        {
          ...auditedProfile.education[0],
          institution: 'Fabricated University of AI',
        },
      ],
    },
    false
  );
  if (agentUpdateRes.success) {
    throw new Error('Agent was able to directly modify authoritative profile facts!');
  }

  // Attempt 2: Agent tries promoteFact directly
  const targetEduId = auditedProfile.education[0].id;
  const agentPromoteRes = ProfileManager.promoteFact('education', targetEduId, false);
  if (agentPromoteRes.success) {
    throw new Error('Agent was able to promote fact directly!');
  }
  if (!agentPromoteRes.error?.includes('SECURITY ENFORCEMENT ERROR')) {
    throw new Error(`Expected security enforcement error, got: ${agentPromoteRes.error}`);
  }

  // Human operator CAN perform updates
  const humanUpdateRes = ProfileManager.updateProfile(
    {
      identity: {
        ...auditedProfile.identity,
        professionalHeadline: 'Software Developer & AI Builder',
      },
    },
    true
  );
  if (!humanUpdateRes.success) {
    throw new Error('Human operator failed to update profile');
  }
  console.log('[PASS] Security policy strictly blocks agents from mutating or promoting facts directly.');

  // ----------------------------------------------------
  // Test 24: Application Drafts Grounded Exclusively in USER_CONFIRMED Facts
  // ----------------------------------------------------
  console.log('\n--- Test 24: Application Drafts Grounded in USER_CONFIRMED Facts ---');
  const draftForAudit = OpportunityManager.tailorResumeAndDraft('opp_seed_1');
  if (!draftForAudit.success || !draftForAudit.application) {
    throw new Error(`Failed to generate application draft: ${draftForAudit.error}`);
  }
  const tailoredResumeForAudit = draftForAudit.application.tailoredResume;

  // Verify tailored projects ONLY contain verified projects
  for (const proj of tailoredResumeForAudit.tailoredProjects) {
    const verifiedInProfile = auditedProfile.projects.find((p) => p.name === proj.name && p.verified);
    if (!verifiedInProfile) {
      throw new Error(`Application draft used unverified project: ${proj.name}`);
    }
  }

  // Verify that cover letter strictly frames candidate as student / aspiring developer without university degree
  const letter = draftForAudit.application.applicationMessage;
  if (letter.toLowerCase().includes('university graduate') || letter.toLowerCase().includes('bachelor of science')) {
    throw new Error('Application message contains prohibited university graduation claims!');
  }
  if (letter.toLowerCase().includes('commercial clients') || letter.toLowerCase().includes('enterprise deployment')) {
    throw new Error('Application message contains fabricated client or enterprise claims!');
  }
  if (!letter.includes('HSC Science student') && !letter.includes('aspiring developer')) {
    throw new Error('Application message must frame candidate as HSC student / aspiring developer');
  }
  console.log('[PASS] Application drafts strictly adhere to USER_CONFIRMED facts and authentic student framing.');

  // ----------------------------------------------------
  // Test 25: Eligibility Check Flags Gaps & Warnings Appropriately
  // ----------------------------------------------------
  console.log('\n--- Test 25: Eligibility Check Flags Gaps & Warnings ---');
  const appRisks = draftForAudit.application.potentialRisks;
  const hasEligibilityWarning = appRisks.some((r) => r.includes('ELIGIBILITY WARNING'));
  if (!hasEligibilityWarning) {
    throw new Error('Draft application for opportunity with unconfirmed criteria did not generate an ELIGIBILITY WARNING!');
  }
  const hasDemoWarning = appRisks.some((r) => r.includes('DEMO DATA NOTICE'));
  if (!hasDemoWarning) {
    throw new Error('Draft application for demo opportunity did not include DEMO DATA NOTICE!');
  }
  console.log('[PASS] Eligibility warnings and demo notices are properly attached to drafts.');

  // ----------------------------------------------------
  // Test 26: Profile Completeness UI Indicator Calculation
  // ----------------------------------------------------
  console.log('\n--- Test 26: Profile Completeness Indicator Calculation ---');
  const completeness = ProfileManager.getProfileCompleteness();
  if (completeness.score !== 100) {
    throw new Error(`Expected 100% completeness for fully populated core profile, got: ${completeness.score}%`);
  }
  if (!completeness.sections.identity || !completeness.sections.education || !completeness.sections.projects || !completeness.sections.skills || !completeness.sections.experience) {
    throw new Error('All core sections (identity, education, projects, skills, experience) should be marked complete');
  }
  // Certifications and achievements must be marked as 'none' (not penalized)
  if (completeness.sections.certifications !== 'none' || completeness.sections.achievements !== 'none') {
    throw new Error('Legitimately none sections (certifications, achievements) must be flagged "none"');
  }
  console.log(`[PASS] Profile completeness calculated: ${completeness.score}% (5/5 applicable core sections complete, zero penalty for legitimate "none").`);

  // ----------------------------------------------------
  // Test 27: Multi-Variant Resume Generation Using Only USER_CONFIRMED Data
  // ----------------------------------------------------
  console.log('\n--- Test 27: Multi-Variant Resume Generation ---');
  const variants = ['master', 'frontend', 'ai', 'internship'] as const;
  for (const v of variants) {
    const resumeDoc = ProfileManager.generateResume(v);
    if (!resumeDoc || !resumeDoc.content) {
      throw new Error(`Failed to generate resume variant: ${v}`);
    }
    const text = resumeDoc.content;
    // Must contain legal name and current education
    if (!text.includes('Md Farhan Hossain') || !text.includes('Pallabi Government College')) {
      throw new Error(`Variant ${v} missing legal name or Pallabi Government College`);
    }
    // Must contain Shwapno experience
    if (!text.includes('Shwapno') || !text.includes('Checkout Assistant / POS Cashier')) {
      throw new Error(`Variant ${v} missing Shwapno Checkout Assistant experience`);
    }
    // Must NOT contain university degrees or graduation claims
    if (text.toLowerCase().includes('bachelor') || text.toLowerCase().includes('computer science graduate') || text.toLowerCase().includes('university student')) {
      throw new Error(`Variant ${v} contains prohibited university or graduation claims!`);
    }
    // Must represent candidate as student / aspiring developer / AI builder
    if (!text.includes('Student') && !text.includes('Software Developer & AI Builder') && !text.includes('Aspiring')) {
      throw new Error(`Variant ${v} missing authentic student / aspiring developer framing`);
    }
  }
  console.log('[PASS] All 4 resume variants generated accurately using only USER_CONFIRMED information.');

  console.log('\n====================================================');
  console.log('ALL 27 FARHAN PROFESSIONAL PROFILE & OPPORTUNITY HQ TESTS PASSED!');
  console.log('====================================================\n');

  db.close();
}

if (process.argv[1]?.includes('opportunity-profile.test.ts')) {
  testOpportunityAndProfileSuite()
    .catch((err) => {
      console.error('OPPORTUNITY & PROFILE TEST SUITE FAILED:', err);
      process.exit(1);
    });
}


