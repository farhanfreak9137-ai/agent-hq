import { TaskPlanner } from '../src/orchestration/TaskPlanner';

async function main() {
  const planner = new TaskPlanner();

  console.log('--- Test 1: Design Goal ---');
  const g1 = planner.decomposeGoal('Design responsive mobile UI dashboard with dark theme');
  const agents1 = g1.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Agents chosen for Design:', agents1);
  if (!agents1.includes('pixel') || agents1.includes('sentinel')) {
    throw new Error('Design goal did not properly select PIXEL or included unnecessary security');
  }

  console.log('\n--- Test 2: Security & Auth Goal ---');
  const g2 = planner.decomposeGoal('Audit CVE vulnerability in JWT token encryption');
  const agents2 = g2.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Agents chosen for Security:', agents2);
  if (!agents2.includes('sentinel') || agents2.includes('pixel')) {
    throw new Error('Security goal did not select SENTINEL or included unnecessary designer');
  }

  console.log('\n--- Test 3: Research Goal ---');
  const g3 = planner.decomposeGoal('Research competitor benchmarks on vector databases and HNSW recall');
  const agents3 = g3.getAllNodes().map((n) => n.assignedAgentId);
  console.log('Agents chosen for Research:', agents3);
  if (!agents3.includes('atlas') || agents3.includes('pixel')) {
    throw new Error('Research goal did not select ATLAS or included unnecessary designer');
  }

  console.log('\n[PASS] Dynamic capability-based goal decomposition verified 100%!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
