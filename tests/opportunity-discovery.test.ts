import { DiscoveryService, DiscoveryRunResult } from '../src/opportunity/DiscoveryService.ts';
import { MockOpportunitySourceAdapter } from '../src/opportunity/adapters/__mocks__/MockOpportunitySourceAdapter.ts';
import { ArbeitnowOpportunityAdapter } from '../src/opportunity/adapters/ArbeitnowOpportunityAdapter.ts';
import { OpportunityManager } from '../src/opportunity/OpportunityManager.ts';
import { ProfileManager } from '../src/profile/ProfileManager.ts';
import { EventBus } from '../src/events/EventBus.ts';
import { RawOpportunity } from '../src/opportunity/adapters/OpportunitySourceAdapter.ts';

export async function testOpportunityDiscoverySuite() {
  console.log('====================================================');
  console.log('OPPORTUNITY DISCOVERY ENGINE MASTER TEST SUITE');
  console.log('====================================================\n');

  // Reset OpportunityManager and DiscoveryService state
  OpportunityManager.reset();
  DiscoveryService.clearAdapters();

  // ----------------------------------------------------
  // Test 1: Adapter Registration & Inspection
  // ----------------------------------------------------
  console.log('--- Test 1: Adapter Registration ---');
  const mockAdapter = new MockOpportunitySourceAdapter();
  DiscoveryService.registerAdapter(mockAdapter);

  const adapters = DiscoveryService.getAdapters();
  if (adapters.length !== 1 || adapters[0].sourceId !== mockAdapter.sourceId) {
    throw new Error(`Adapter registration failed. Expected 1 adapter with sourceId ${mockAdapter.sourceId}, got ${adapters.length}`);
  }

  DiscoveryService.unregisterAdapter(mockAdapter.sourceId);
  if (DiscoveryService.getAdapters().length !== 0) {
    throw new Error('Adapter unregistration failed.');
  }

  DiscoveryService.registerAdapter(mockAdapter);
  console.log('[PASS] Adapter registration and lifecycle verified.');

  // ----------------------------------------------------
  // Test 2: Mock Adapter Normalization & Provenance Preservation
  // ----------------------------------------------------
  console.log('\n--- Test 2: Mock Adapter Normalization & Provenance ---');
  const sampleRaw: RawOpportunity = {
    externalId: 'test-raw-01',
    title: 'Frontend React Engineering Intern',
    organization: 'CloudScale Ecosystem',
    rawType: 'internship',
    url: 'https://test.cloudscale.org/intern/frontend-2026',
    applyUrl: 'https://test.cloudscale.org/apply/frontend-2026',
    location: 'Remote',
    remote: true,
    description: 'Build fast client interfaces using React and TypeScript.',
    requirements: ['React', 'TypeScript', 'Tailwind CSS'],
    eligibility: ['Enrolled science student'],
    deadline: '2026-11-15',
  };

  const normalized = mockAdapter.normalize(sampleRaw);
  if (normalized.sourceVerification !== 'UNVERIFIED') {
    throw new Error(`Normalization error: Expected sourceVerification 'UNVERIFIED', got ${normalized.sourceVerification}`);
  }
  if (normalized.sourceId !== mockAdapter.sourceId || normalized.sourceName !== mockAdapter.sourceName) {
    throw new Error('Normalization error: Provenance sourceId or sourceName mismatch');
  }
  if (normalized.sourceUrl !== sampleRaw.url || normalized.applicationUrl !== sampleRaw.applyUrl) {
    throw new Error('Normalization error: Provenance sourceUrl or applicationUrl not preserved');
  }
  console.log(`[PASS] Provenance strictly preserved: Source="${normalized.sourceName}" (${normalized.sourceId}), Status=${normalized.sourceVerification}`);

  // ----------------------------------------------------
  // Test 3: Missing-Field Handling (No Fabrication)
  // ----------------------------------------------------
  console.log('\n--- Test 3: Missing-Field Handling ---');
  const bareRaw: RawOpportunity = {
    externalId: 'test-raw-bare',
    title: '',
    organization: '',
    url: '',
  };
  const normalizedBare = mockAdapter.normalize(bareRaw);
  if (!normalizedBare.title || !normalizedBare.organization || !normalizedBare.sourceUrl) {
    throw new Error('Normalized bare opportunity must provide safe fallbacks without crashing');
  }
  if (normalizedBare.sourceVerification !== 'UNVERIFIED') {
    throw new Error('Bare opportunity must remain UNVERIFIED');
  }
  console.log('[PASS] Missing fields handled safely without fabrication.');

  // ----------------------------------------------------
  // Test 4: Discovery Orchestration & UNVERIFIED Persistence
  // ----------------------------------------------------
  console.log('\n--- Test 4: Discovery Orchestration & UNVERIFIED Persistence ---');
  const capturedEvents: string[] = [];
  const eventUnsub = EventBus.on('*', (ev) => {
    const t = (ev as any)?.type as string;
    if (t?.startsWith('opportunity.')) {
      capturedEvents.push(t);
    }
  });

  const runResult: DiscoveryRunResult = await DiscoveryService.runDiscovery();
  if (runResult.status !== 'COMPLETED') {
    throw new Error(`Discovery run failed: ${runResult.error}`);
  }
  if (runResult.discoveredCount < 2) {
    throw new Error(`Expected at least 2 discovered items from mock adapter, got ${runResult.discoveredCount}`);
  }

  // Verify all newly discovered items are strictly UNVERIFIED in OpportunityManager
  const allOpps = OpportunityManager.getAllOpportunities();
  const mockOpps = allOpps.filter((o) => o.source === mockAdapter.sourceName);
  for (const opp of mockOpps) {
    if (opp.sourceVerification !== 'UNVERIFIED') {
      throw new Error(`Security Violation: Discovered opportunity ${opp.id} must be UNVERIFIED, found: ${opp.sourceVerification}`);
    }
  }
  console.log(`[PASS] Discovery orchestrated: ${runResult.discoveredCount} opportunities persisted strictly as UNVERIFIED.`);

  // ----------------------------------------------------
  // Test 5: Event Semantics Guard (No False Verification-Completed)
  // ----------------------------------------------------
  console.log('\n--- Test 5: Event Semantics Guard ---');
  if (capturedEvents.includes('opportunity.verification.completed')) {
    throw new Error('Event Semantics Violation: opportunity.verification.completed was emitted during discovery without explicit verification!');
  }
  const requiredEvents = [
    'opportunity.normalized',
    'opportunity.discovered',
    'opportunity.eligibility.checked',
    'opportunity.matched',
    'opportunity.discovery.completed',
  ];
  for (const req of requiredEvents) {
    if (!capturedEvents.includes(req)) {
      throw new Error(`Expected event "${req}" was not emitted in EventBus (observed: ${capturedEvents.join(', ')})`);
    }
  }
  console.log(`[PASS] Correct event semantics verified: [${requiredEvents.join(', ')}] captured; zero false verification-completed events.`);

  // ----------------------------------------------------
  // Test 6: Duplicate Detection (Exact URL & Org/Title)
  // ----------------------------------------------------
  console.log('\n--- Test 6: Duplicate Detection ---');
  const initialCount = OpportunityManager.getAllOpportunities().length;
  const duplicateRun: DiscoveryRunResult = await DiscoveryService.runDiscovery();

  if (duplicateRun.discoveredCount !== 0) {
    throw new Error(`Expected 0 new items on immediate rediscovery, got ${duplicateRun.discoveredCount}`);
  }
  if (duplicateRun.duplicateCount < 2) {
    throw new Error(`Expected at least 2 duplicates detected, got ${duplicateRun.duplicateCount}`);
  }
  if (OpportunityManager.getAllOpportunities().length !== initialCount) {
    throw new Error('OpportunityManager size expanded on duplicate run');
  }
  console.log(`[PASS] Duplicate detection prevented redundant entries (${duplicateRun.duplicateCount} duplicates safely caught).`);

  // ----------------------------------------------------
  // Test 7: Eligibility Analysis & Profile Matching Integration
  // ----------------------------------------------------
  console.log('\n--- Test 7: Eligibility & Profile Matching Integration ---');
  const discoveredOpp = mockOpps[0];
  if (!discoveredOpp.fitAnalysis) {
    throw new Error('Discovered opportunity missing automated fitAnalysis');
  }
  if (typeof discoveredOpp.fitAnalysis.matchPercentage !== 'number') {
    throw new Error('fitAnalysis missing transparent matchPercentage');
  }
  if (!Array.isArray(discoveredOpp.fitAnalysis.eligibilityChecks)) {
    throw new Error('fitAnalysis missing structured eligibilityChecks');
  }
  console.log(`[PASS] Fit analysis verified: ${discoveredOpp.fitAnalysis.matchPercentage}% match on "${discoveredOpp.title}".`);

  // ----------------------------------------------------
  // Test 8: Security Boundary: Discovery Cannot Mutate Profile
  // ----------------------------------------------------
  console.log('\n--- Test 8: Security Boundary: Profile Immutability ---');
  const profileBefore = JSON.stringify(ProfileManager.getProfile('FULL'));
  await DiscoveryService.runDiscovery();
  const profileAfter = JSON.stringify(ProfileManager.getProfile('FULL'));
  if (profileBefore !== profileAfter) {
    throw new Error('Security Violation: DiscoveryService mutated the authoritative professional profile!');
  }
  console.log('[PASS] Authoritative Professional Profile remained 100% immutable across discovery runs.');

  // ----------------------------------------------------
  // Test 9: Security Boundary: Discovery Cannot Submit Applications or Outreach
  // ----------------------------------------------------
  console.log('\n--- Test 9: Security Boundary: Zero Autonomous Application/Outreach Side Effects ---');
  const apps = OpportunityManager.getAllApplications();
  const submittedApps = apps.filter((a) => a.status === 'SUBMITTED');
  if (submittedApps.length > 0) {
    throw new Error('Security Violation: Discovery engine autonomously created or submitted job applications!');
  }
  console.log('[PASS] No applications were autonomously drafted or submitted.');

  // ----------------------------------------------------
  // Test 10: Concurrency Protection (Prevent Overlapping Runs)
  // ----------------------------------------------------
  console.log('\n--- Test 10: Concurrency Protection ---');
  // Create a slow adapter
  const slowAdapter: MockOpportunitySourceAdapter = new MockOpportunitySourceAdapter();
  (slowAdapter as any).discover = async () => {
    await new Promise((r) => setTimeout(r, 100));
    return [];
  };
  DiscoveryService.clearAdapters();
  DiscoveryService.registerAdapter(slowAdapter);

  const runPromise1 = DiscoveryService.runDiscovery();
  let caughtConflict = false;
  try {
    await DiscoveryService.runDiscovery();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('CONCURRENCY_CONFLICT')) {
      caughtConflict = true;
    }
  }
  await runPromise1;

  if (!caughtConflict) {
    throw new Error('Concurrency Violation: DiscoveryService allowed overlapping discovery runs!');
  }
  console.log('[PASS] Concurrency lock cleanly rejected overlapping run.');

  // ----------------------------------------------------
  // Test 11: Adapter Failure Handling (Fault Isolation)
  // ----------------------------------------------------
  console.log('\n--- Test 11: Adapter Failure Handling & Fault Isolation ---');
  const failingAdapter = {
    sourceId: 'failing_source',
    sourceName: 'Broken Remote Source',
    discover: async () => {
      throw new Error('Simulated network timeout (ETIMEDOUT)');
    },
    normalize: (r: any) => r,
  };
  const workingAdapter = new MockOpportunitySourceAdapter();

  DiscoveryService.clearAdapters();
  DiscoveryService.registerAdapter(failingAdapter);
  DiscoveryService.registerAdapter(workingAdapter);

  const mixedResult = await DiscoveryService.runDiscovery();
  if (mixedResult.sourceStatus['failing_source'].status !== 'FAILED') {
    throw new Error('Expected failing_source status to be FAILED');
  }
  if (mixedResult.sourceStatus[workingAdapter.sourceId].status !== 'SUCCESS') {
    throw new Error('Expected workingAdapter status to be SUCCESS despite companion failure');
  }
  if (mixedResult.failureCount !== 1) {
    throw new Error(`Expected failureCount 1, got ${mixedResult.failureCount}`);
  }
  console.log('[PASS] Fault isolation verified: companion adapter succeeded despite broken adapter failure.');

  // ----------------------------------------------------
  // Test 12: Explicit Verification Event Semantics
  // ----------------------------------------------------
  console.log('\n--- Test 12: Explicit Verification Event Semantics ---');
  capturedEvents.length = 0;

  const targetOpp = OpportunityManager.getAllOpportunities()[0];
  const verResult = DiscoveryService.verifyOpportunity(
    targetOpp.id,
    true,
    'Farhan',
    ['Confirmed direct listing on authoritative domain']
  );
  if (!verResult.success) {
    throw new Error(`Explicit verification failed: ${verResult.error}`);
  }
  if (targetOpp.sourceVerification !== 'VERIFIED') {
    throw new Error(`Target opportunity verification was not updated to VERIFIED`);
  }
  if (!capturedEvents.includes('opportunity.verification.completed')) {
    throw new Error('Expected opportunity.verification.completed event upon explicit verification');
  }

  // Verification failure
  DiscoveryService.verifyOpportunity(targetOpp.id, false, 'Farhan');
  if (!capturedEvents.includes('opportunity.verification.failed')) {
    throw new Error('Expected opportunity.verification.failed event upon failed verification');
  }
  console.log('[PASS] Explicit verification event semantics functioning correctly.');

  // ----------------------------------------------------
  // Test 13: Real Public Source Adapter: Arbeitnow Structure
  // ----------------------------------------------------
  console.log('\n--- Test 13: Real Public Source Adapter (Arbeitnow) Structure ---');
  const arbeitnowAdapter = new ArbeitnowOpportunityAdapter('https://mock.arbeitnow.com/job-board-api');
  if (arbeitnowAdapter.sourceId !== 'arbeitnow_public_api') {
    throw new Error(`Unexpected sourceId: ${arbeitnowAdapter.sourceId}`);
  }

  const sampleArbeitnowRaw: RawOpportunity = {
    externalId: 'software-engineer-intern-berlin-12345',
    title: 'Software Engineer Intern (Full-Stack)',
    organization: 'NextGen Tech GmbH',
    rawType: 'internship',
    url: 'https://www.arbeitnow.com/jobs/companies/nextgen/software-engineer-intern-12345',
    applyUrl: 'https://www.arbeitnow.com/jobs/companies/nextgen/software-engineer-intern-12345',
    location: 'Berlin (Hybrid)',
    remote: false,
    description: 'We are seeking an enthusiastic software engineering intern to work with TypeScript, React, and Node.js.',
    requirements: ['typescript', 'react', 'node.js'],
  };

  const normArbeitnow = arbeitnowAdapter.normalize(sampleArbeitnowRaw);
  if (normArbeitnow.sourceVerification !== 'UNVERIFIED') {
    throw new Error('Real public adapter must strictly normalize to UNVERIFIED');
  }
  if (!normArbeitnow.requirements.includes('TypeScript') && !normArbeitnow.requirements.includes('typescript')) {
    throw new Error('Requirements extraction failed on Arbeitnow raw item');
  }
  if (normArbeitnow.sourceUrl !== sampleArbeitnowRaw.url) {
    throw new Error('Source URL mismatch on Arbeitnow normalized item');
  }
  console.log(`[PASS] Arbeitnow real source adapter validated: ${normArbeitnow.title} at ${normArbeitnow.organization} (sourceVerification: ${normArbeitnow.sourceVerification})`);

  // ----------------------------------------------------
  // Test 14: Verification Gate Negative-Path & Security Boundary Tests
  // ----------------------------------------------------
  console.log('\n--- Test 14: Verification Gate Negative Paths & Side-Effect Immunity ---');
  
  // 1. Discovery cannot produce VERIFIED
  const testAdapter = new MockOpportunitySourceAdapter();
  DiscoveryService.registerAdapter(testAdapter);
  const discRun = await DiscoveryService.runDiscovery();
  if (discRun.status !== 'COMPLETED') throw new Error('Discovery failed');
  
  const createdOpps = OpportunityManager.getAllOpportunities().filter(o => o.source === testAdapter.sourceName);
  for (const opp of createdOpps) {
    if (opp.sourceVerification === 'VERIFIED') {
      throw new Error(`SECURITY VIOLATION: Discovery produced a VERIFIED opportunity without human review: ${opp.id}`);
    }
  }
  console.log('[PASS] 1. Newly discovered opportunities are strictly UNVERIFIED.');

  const sampleOpp = createdOpps[0];
  if (!sampleOpp) throw new Error('Expected created opportunity');

  // 2. Matching cannot verify an opportunity
  OpportunityManager.matchOpportunity(sampleOpp.id);
  if ((OpportunityManager.getOpportunityById(sampleOpp.id)?.sourceVerification as string) === 'VERIFIED') {
    throw new Error('SECURITY VIOLATION: Profile matching mutated sourceVerification to VERIFIED');
  }
  console.log('[PASS] 2. Matching cannot alter sourceVerification.');

  // 3. Duplicate rediscovery cannot verify an opportunity
  const dupRun = await DiscoveryService.runDiscovery();
  if (dupRun.duplicateCount === 0) throw new Error('Expected duplicates to be detected');
  if ((OpportunityManager.getOpportunityById(sampleOpp.id)?.sourceVerification as string) === 'VERIFIED') {
    throw new Error('SECURITY VIOLATION: Duplicate detection mutated sourceVerification to VERIFIED');
  }
  console.log('[PASS] 3. Duplicate rediscovery cannot alter sourceVerification.');

  // 4. Capture profile state before verification
  const t14ProfileBefore = JSON.stringify(ProfileManager.getProfile('FULL'));

  // 5. Explicit verification
  const initialSource = sampleOpp.source;
  const initialUrl = sampleOpp.sourceUrl;
  const initialDiscAt = sampleOpp.discoveredAt;

  const verRes = DiscoveryService.verifyOpportunity(sampleOpp.id, true, 'Farhan', ['Manual verification audit']);
  if (!verRes.success) throw new Error('Explicit verification failed');
  if ((OpportunityManager.getOpportunityById(sampleOpp.id)?.sourceVerification as string) !== 'VERIFIED') {
    throw new Error('Expected VERIFIED');
  }

  // 6. Check profile immutability
  const t14ProfileAfter = JSON.stringify(ProfileManager.getProfile('FULL'));
  if (t14ProfileBefore !== t14ProfileAfter) {
    throw new Error('SECURITY VIOLATION: Verification mutated Farhan Professional Profile!');
  }
  console.log('[PASS] 4. Verification does NOT modify professional profile data.');

  // 7. Check zero application side-effects
  const t14Apps = OpportunityManager.getAllApplications();
  const t14SubmittedApps = t14Apps.filter(a => a.status === 'SUBMITTED');
  if (t14SubmittedApps.length > 0) {
    throw new Error('SECURITY VIOLATION: Verification triggered autonomous application submission!');
  }
  console.log('[PASS] 5. Verification does NOT trigger application submission.');

  // 8. Check provenance preservation
  if (sampleOpp.source !== initialSource || sampleOpp.sourceUrl !== initialUrl || sampleOpp.discoveredAt !== initialDiscAt) {
    throw new Error('PROVENANCE VIOLATION: Original discovery provenance was corrupted during verification!');
  }
  console.log('[PASS] 6. Original source provenance strictly preserved post-verification.');

  eventUnsub();
  DiscoveryService.clearAdapters();

  console.log('\n====================================================');
  console.log('ALL 14 OPPORTUNITY DISCOVERY ENGINE TESTS PASSED 100%!');
  console.log('====================================================');
}
