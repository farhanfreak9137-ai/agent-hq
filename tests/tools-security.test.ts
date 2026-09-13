import { MockToolExecutor, BUILTIN_SIMULATED_TOOLS } from '../src/agents/ToolExecutor.ts';
import { AgentTool } from '../src/types/index.ts';

export async function testToolSecurity(): Promise<boolean> {
  console.log('\n--- 4. Testing Tool Security & Permission Boundaries ---');

  const executor = new MockToolExecutor(10);

  // 1. Verify Builtin Tools have Risk Levels and Capabilities
  for (const tool of BUILTIN_SIMULATED_TOOLS) {
    if (!tool.riskLevel || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(tool.riskLevel)) {
      throw new Error(`Tool security failure: Tool "${tool.id}" missing valid riskLevel`);
    }
    if (!tool.capability) {
      throw new Error(`Tool security failure: Tool "${tool.id}" missing capability`);
    }
  }
  console.log(`✓ All ${BUILTIN_SIMULATED_TOOLS.length} builtin tools declare risk levels and capabilities`);

  // 2. Test Execution with Authorized Capability
  const codeAnalysisTool = BUILTIN_SIMULATED_TOOLS.find((t) => t.id === 'tool_code_analysis')!;
  const result = await executor.execute(codeAnalysisTool, {}, ['coding']);
  if (!result.success || !result.output.includes('AST inspection clean')) {
    throw new Error('Tool execution failed for authorized capability');
  }
  console.log('✓ Authorized agent successfully executes allowed tool');

  // 3. Test Rejection when Agent Lacks Capability
  const unauthorizedResult = await executor.execute(codeAnalysisTool, {}, ['design']); // Designer trying to use coding tool
  if (unauthorizedResult.success || !unauthorizedResult.error?.includes('Permission Denied')) {
    throw new Error('Tool security failure: agent executed tool without matching capability');
  }
  console.log('✓ Unauthorized agent correctly blocked from tool without matching capability');

  // 4. Test Blocking of Arbitrary Shell / Filesystem / Credential Tools
  const dangerousTools: AgentTool[] = [
    {
      id: 'tool_shell_exec',
      name: 'Arbitrary Shell Runner',
      description: 'Executes rm -rf /',
      capability: 'coding',
      riskLevel: 'CRITICAL',
    },
    {
      id: 'tool_delete_fs',
      name: 'Filesystem Deleter',
      description: 'Deletes local directories',
      capability: 'security',
      riskLevel: 'CRITICAL',
    },
    {
      id: 'tool_credential_dump',
      name: 'Credential Scraper',
      description: 'Dumps auth tokens',
      capability: 'security',
      riskLevel: 'CRITICAL',
    },
  ];

  for (const dangerous of dangerousTools) {
    const res = await executor.execute(dangerous, {}, ['coding', 'security']);
    if (res.success || !res.error?.includes('CRITICAL RISK')) {
      throw new Error(`Security failure: Dangerous tool "${dangerous.id}" was not blocked!`);
    }
  }
  console.log('✓ Arbitrary shell, filesystem, and credential access tools strictly blocked');

  return true;
}
