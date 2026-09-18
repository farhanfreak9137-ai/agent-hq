import { testDag } from './dag.test.ts';
import { testScheduler } from './scheduler.test.ts';
import { testProviders } from './providers.test.ts';
import { testSmoke } from './smoke.test.ts';
import { testDatabaseAndRepositories } from './db.test.ts';
import { testRecoveryAndResumption } from './recovery.test.ts';
import { testAuthAndAuthorization } from './auth.test.ts';
import { testToolSecurity } from './tools-security.test.ts';
import { testSecurityAudit } from './security-audit.test.ts';
import { runPhase3bTests } from './phase3b.test.ts';
import { runLoadTest } from './load.test.ts';
import { testProspectingAgents } from './prospecting-agents.test.ts';
import { testOpportunityAndProfileSuite } from './opportunity-profile.test.ts';
import { testOpportunityDiscoverySuite } from './opportunity-discovery.test.ts';

async function main() {
  console.log('====================================================');
  console.log('AGENT HQ — Master Automated Test Suite (Phases 2 - 3B & Opportunity HQ)');
  console.log('====================================================\n');

  try {
    // Phase 2: DAG, Scheduler, Providers
    await testDag();
    await testScheduler();
    await testProviders();

    // Phase 2.5: Real Provider Smoke & Cascading Failure
    await testSmoke();

    // Phase 3A: Persistence, Recovery, Auth, Tool Security & Audits
    console.log('====================================================');
    console.log('AGENT HQ — Phase 3A Production Infrastructure Tests');
    console.log('====================================================');

    await testDatabaseAndRepositories();
    await testRecoveryAndResumption();
    await testAuthAndAuthorization();
    await testToolSecurity();
    await testSecurityAudit();

    // Phase 3B: Advanced Agent Intelligence, Memory, Observability & Scale
    await runPhase3bTests();
    await runLoadTest();

    // Specialized Agents: Strategist, CRM / Operations, Outreach
    await testProspectingAgents();

    // Farhan Professional Profile & Opportunity HQ
    await testOpportunityAndProfileSuite();

    // Opportunity Discovery Engine & Adapters Suite
    await testOpportunityDiscoverySuite();

    // Physical Workspace File Engine & Intent Decomposition Suite
    console.log('====================================================');
    console.log('AGENT HQ — Physical Workspace File Engine & Intent Suite');
    console.log('====================================================');
    const { execSync } = await import('child_process');
    execSync('npx tsx tests/workspace-files.test.ts', { stdio: 'inherit' });

    console.log('\n====================================================');
    console.log('ALL AGENT HQ TEST SUITES PASSED 100%!');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('\nFAILED TESTS:', error);
    process.exit(1);
  }
}

main();
