import { WorkspaceFileManager } from '../server/services/WorkspaceFileManager.ts';
import { TaskPlanner } from '../src/orchestration/TaskPlanner.ts';

async function testWorkspaceAndDecomposition() {
  console.log('====================================================');
  console.log('WORKSPACE & INTENT DECOMPOSITION TEST SUITE');
  console.log('====================================================\n');

  const planner = new TaskPlanner();

  // Test 1: Case Study / Document Generation Intent
  console.log('--- Test 1: Document & Case Study DAG Routing ---');
  const docDag = planner.decomposeGoal('Create a polished portfolio case study for Agent HQ using verified repository facts');
  const docAgents = docDag.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Doc DAG Agents:', docAgents.join(' -> '));
  if (!docAgents.includes('atlas') || !docAgents.includes('quill') || !docAgents.includes('echo')) {
    throw new Error(`Document DAG failed routing! Found: ${docAgents.join(', ')}`);
  }
  console.log('[PASS] Document / Case Study DAG routed correctly to ATLAS -> QUILL -> ECHO.\n');

  // Test 2: Creative Writing / Novel Intent
  console.log('--- Test 2: Creative Writing & Novel DAG Routing ---');
  const novelDag = planner.decomposeGoal('Write the next chapter of my sci-fi novel about deep space exploration');
  const novelAgents = novelDag.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Novel DAG Agents:', novelAgents.join(' -> '));
  if (!novelAgents.includes('quill') || !novelAgents.includes('echo')) {
    throw new Error(`Creative Writing DAG failed routing! Found: ${novelAgents.join(', ')}`);
  }
  console.log('[PASS] Novel DAG routed correctly to QUILL (Writer) -> ECHO (Reviewer).\n');

  // Test 3: Spreadsheet / Excel Intent
  console.log('--- Test 3: Spreadsheet & Excel DAG Routing ---');
  const sheetDag = planner.decomposeGoal('Research AI agent performance and generate an Excel spreadsheet (.xlsx)');
  const sheetAgents = sheetDag.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Sheet DAG Agents:', sheetAgents.join(' -> '));
  if (!sheetAgents.includes('atlas') || !sheetAgents.includes('strategist')) {
    throw new Error(`Spreadsheet DAG failed routing! Found: ${sheetAgents.join(', ')}`);
  }
  console.log('[PASS] Spreadsheet DAG routed correctly to ATLAS -> STRATEGIST.\n');

  // Test 4: Physical File Creation In Workspace
  console.log('--- Test 4: Physical File Generation in workspace/ ---');
  const files = WorkspaceFileManager.listFiles();
  const caseStudyMd = files.find((f) => f.filename === 'agent-hq-case-study.md');
  const caseStudyDocx = files.find((f) => f.filename === 'agent-hq-case-study.docx');

  if (!caseStudyMd || caseStudyMd.sizeBytes === 0) {
    throw new Error('Missing or empty agent-hq-case-study.md in workspace!');
  }
  if (!caseStudyDocx || caseStudyDocx.sizeBytes === 0) {
    throw new Error('Missing or empty agent-hq-case-study.docx in workspace!');
  }
  console.log(`[PASS] Case Study files verified in workspace/:`);
  console.log(` - ${caseStudyMd.filename} (${caseStudyMd.sizeBytes} bytes)`);
  console.log(` - ${caseStudyDocx.filename} (${caseStudyDocx.sizeBytes} bytes)`);

  console.log('\n====================================================');
  console.log('ALL WORKSPACE & DECOMPOSITION TESTS PASSED 100%!');
  console.log('====================================================\n');
}

testWorkspaceAndDecomposition()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
