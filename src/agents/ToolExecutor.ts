import { AgentCapability, AgentTool, ToolExecutionResult, ToolRiskPolicy } from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';
import { HumanApprovalManager } from '../security/HumanApprovalManager.ts';

export interface ToolExecutionOptions {
  input?: Record<string, unknown>;
  agentCapabilities?: AgentCapability[];
  agentId?: string;
  taskId?: string;
  timeoutMs?: number;
  skipHumanApprovalForTest?: boolean;
}

export interface ToolExecutor {
  execute(tool: AgentTool, options?: ToolExecutionOptions): Promise<ToolExecutionResult>;
  listTools(capability?: AgentCapability): AgentTool[];
  checkPermission(tool: AgentTool, agentCapabilities?: AgentCapability[]): { allowed: boolean; reason?: string };
}

/**
 * Built-in controlled tools with explicit risk policies and schema definitions.
 */
export const BUILTIN_CONTROLLED_TOOLS: AgentTool[] = [
  {
    id: 'tool_code_analysis',
    name: 'Static Code & AST Analyzer',
    description: 'Performs AST traversal, dead code elimination analysis, and type-safety boundary checks.',
    capability: 'coding',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'coding',
    inputSchema: {
      codeSnippet: { type: 'string', description: 'Code block to analyze', required: false },
      targetPath: { type: 'string', description: 'Relative source path', required: false },
    },
    timeoutMs: 5000,
  },
  {
    id: 'tool_test_runner',
    name: 'Chaos & Integration Test Suite',
    description: 'Executes simulated fuzz tests, regression suites, and latency boundary assertions.',
    capability: 'testing',
    riskLevel: 'MEDIUM',
    policyRiskLevel: 'CONTROLLED',
    requiredCapability: 'testing',
    inputSchema: {
      testSuite: { type: 'string', description: 'Target test suite name', required: false },
      iterations: { type: 'number', description: 'Number of fuzz iterations', required: false },
    },
    timeoutMs: 10000,
  },
  {
    id: 'tool_search',
    name: 'Knowledge & Benchmark Indexer',
    description: 'Aggregates vector database latency benchmarks, algorithm trade-offs, and technical papers.',
    capability: 'research',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'research',
    inputSchema: {
      query: { type: 'string', description: 'Search keywords or phrase', required: false },
    },
    timeoutMs: 5000,
  },
  {
    id: 'tool_security_scanner',
    name: 'Zero-Trust & CVE Vulnerability Scanner',
    description: 'Audits asymmetric signature verification, dependency SBOM, and rate-limiting entropy.',
    capability: 'security',
    riskLevel: 'HIGH',
    policyRiskLevel: 'CONTROLLED',
    requiredCapability: 'security',
    inputSchema: {
      targetScope: { type: 'string', description: 'Target security boundary', required: false },
    },
    timeoutMs: 8000,
  },
  {
    id: 'tool_design_system',
    name: 'Design System & Contrast Validator',
    description: 'Evaluates color contrast, spatial layout grids, visual hierarchy, and component states.',
    capability: 'design',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'design',
    inputSchema: {
      component: { type: 'string', description: 'Component or layout identifier', required: false },
    },
    timeoutMs: 5000,
  },
  {
    id: 'tool_file_inspection',
    name: 'Code Review & Interface Inspector',
    description: 'Audits PR diffs, boundary contracts, and concurrency locks for latent race conditions.',
    capability: 'review',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'review',
    inputSchema: {
      diffUrl: { type: 'string', description: 'PR diff or patch reference', required: false },
    },
    timeoutMs: 5000,
  },
  {
    id: 'tool_task_planner',
    name: 'Mission Deconstructor & Workload Planner',
    description: 'Deconstructs high-level objectives into parallel task streams and balances workload.',
    capability: 'orchestration',
    riskLevel: 'MEDIUM',
    policyRiskLevel: 'CONTROLLED',
    requiredCapability: 'orchestration',
    inputSchema: {
      objective: { type: 'string', description: 'High level initiative goal', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_repo_inspect',
    name: 'Sandboxed Workspace Inspector',
    description: 'Safely inspects project directory structures, strictly prohibiting access to .env or .git.',
    capability: 'coding',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'coding',
    inputSchema: {
      subDir: { type: 'string', description: 'Relative path within workspace', required: false },
    },
    timeoutMs: 3000,
  },
  {
    id: 'tool_doc_gen',
    name: 'Deliverable Documentation Generator',
    description: 'Synthesizes verified Markdown technical documentation and specifications.',
    capability: 'research',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'research',
    inputSchema: {
      topic: { type: 'string', description: 'Documentation subject', required: false },
    },
    timeoutMs: 4000,
  },
  {
    id: 'tool_restricted_deploy',
    name: 'Production Gate & Cryptographic Release',
    description: 'Deploys signed cryptographic packages to production cluster. Requires explicit human sign-off.',
    capability: 'security',
    riskLevel: 'CRITICAL',
    policyRiskLevel: 'RESTRICTED',
    requiredCapability: 'security',
    inputSchema: {
      releaseTag: { type: 'string', description: 'Semantic version tag', required: false },
    },
    timeoutMs: 15000,
  },
];

// Backwards compatibility export
export const BUILTIN_SIMULATED_TOOLS = BUILTIN_CONTROLLED_TOOLS;

/**
 * Enterprise ToolExecutor with:
 * - SAFE, CONTROLLED, RESTRICTED policy risk enforcement
 * - Human-in-the-loop approval boundary for RESTRICTED operations
 * - Input & output schema verification
 * - Configurable timeouts
 * - Absolute sandboxing against OS destruction, shell execution, or credential extraction
 */
export class MockToolExecutor implements ToolExecutor {
  private readonly executionDelayMs: number;

  constructor(executionDelayMs: number = 200) {
    this.executionDelayMs = executionDelayMs;
  }

  public listTools(capability?: AgentCapability): AgentTool[] {
    if (capability) {
      return BUILTIN_CONTROLLED_TOOLS.filter((t) => t.capability === capability);
    }
    return [...BUILTIN_CONTROLLED_TOOLS];
  }

  /**
   * Validate tool input parameters against declared schema.
   */
  public validateInput(tool: AgentTool, input?: Record<string, unknown>): { valid: boolean; error?: string } {
    if (!tool.inputSchema || !input) return { valid: true };

    for (const [key, schema] of Object.entries(tool.inputSchema)) {
      if (schema.required && (input[key] === undefined || input[key] === null)) {
        return { valid: false, error: `Missing required parameter "${key}" for tool "${tool.name}".` };
      }
      if (input[key] !== undefined && schema.type) {
        const actualType = typeof input[key];
        if (actualType !== schema.type) {
          return {
            valid: false,
            error: `Invalid type for parameter "${key}": expected ${schema.type}, got ${actualType}.`,
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Enforces tool capability permission and risk boundaries.
   */
  public checkPermission(tool: AgentTool, agentCapabilities?: AgentCapability[]): { allowed: boolean; reason?: string } {
    const toolIdLower = tool.id.toLowerCase();
    // 1. Absolutely prohibit unsafe OS/credential/filesystem tools
    if (
      toolIdLower.includes('shell') ||
      toolIdLower.includes('exec') ||
      toolIdLower.includes('rm_') ||
      toolIdLower.includes('delete_fs') ||
      toolIdLower.includes('credential') ||
      toolIdLower.includes('secret')
    ) {
      return {
        allowed: false,
        reason: `CRITICAL RISK: Arbitrary OS/credential/filesystem tool "${tool.id}" is strictly blocked by Agent HQ security policy.`,
      };
    }

    // 2. Verify capability match
    if (agentCapabilities && agentCapabilities.length > 0) {
      const required = tool.requiredCapability || tool.capability;
      if (required && !agentCapabilities.includes(required)) {
        return {
          allowed: false,
          reason: `Permission Denied: Agent lacks required capability "${required}" to execute tool "${tool.name}".`,
        };
      }
    }

    return { allowed: true };
  }

  public async execute(
    tool: AgentTool,
    inputOrOptions?: unknown,
    legacyCaps?: AgentCapability[]
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Normalize arguments for backward compatibility
    let options: ToolExecutionOptions = {};
    if (inputOrOptions && typeof inputOrOptions === 'object' && ('agentCapabilities' in inputOrOptions || 'agentId' in inputOrOptions)) {
      options = inputOrOptions as ToolExecutionOptions;
    } else {
      options = {
        input: (inputOrOptions as Record<string, unknown>) || {},
        agentCapabilities: legacyCaps,
      };
    }

    // 1. Permission check
    const perm = this.checkPermission(tool, options.agentCapabilities);
    if (!perm.allowed) {
      return {
        toolId: tool.id,
        toolName: tool.name,
        success: false,
        output: '',
        error: perm.reason,
        durationMs: 1,
        riskLevel: tool.riskLevel || 'HIGH',
      };
    }

    // 2. Schema input validation
    const inputValidation = this.validateInput(tool, options.input);
    if (!inputValidation.valid) {
      return {
        toolId: tool.id,
        toolName: tool.name,
        success: false,
        output: '',
        error: `Input Validation Failed: ${inputValidation.error}`,
        durationMs: 1,
        riskLevel: tool.riskLevel || 'MEDIUM',
      };
    }

    // 3. Human approval boundary for RESTRICTED tools
    const policy = tool.policyRiskLevel || (tool.riskLevel === 'CRITICAL' ? 'RESTRICTED' : 'SAFE');
    if (policy === 'RESTRICTED' && !options.skipHumanApprovalForTest) {
      const approval = await HumanApprovalManager.getInstance().requestApproval({
        taskId: options.taskId || 'task_restricted',
        agentId: options.agentId || 'agent',
        toolId: tool.id,
        toolName: tool.name,
        parameters: options.input,
        reason: `Executing critical tool [${tool.name}] requires human operator authorization.`,
      });

      if (!approval.approved) {
        return {
          toolId: tool.id,
          toolName: tool.name,
          success: false,
          output: '',
          error: `Human Approval Denied: ${approval.reason}`,
          durationMs: Date.now() - startTime,
          riskLevel: 'CRITICAL',
        };
      }
    }

    // 4. Execution with timeout enforcement
    const timeoutMs = options.timeoutMs || tool.timeoutMs || 10000;
    const executionPromise = this.runToolLogic(tool, options.input);

    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    try {
      const output = await Promise.race([executionPromise, timeoutPromise]);
      const durationMs = Date.now() - startTime;

      EventBus.emit({
        id: generateId('ev_tool'),
        type: 'runtime.tool_completed',
        timestamp: Date.now(),
        message: `Tool [${tool.name}] executed successfully (${durationMs}ms, policy: ${policy}).`,
        tool,
        durationMs,
      } as any);

      return {
        toolId: tool.id,
        toolName: tool.name,
        success: true,
        output,
        durationMs,
        riskLevel: tool.riskLevel || 'LOW',
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        toolId: tool.id,
        toolName: tool.name,
        success: false,
        output: '',
        error: errorMsg,
        durationMs: Date.now() - startTime,
        riskLevel: tool.riskLevel || 'HIGH',
      };
    }
  }

  private async runToolLogic(tool: AgentTool, input?: Record<string, unknown>): Promise<string> {
    if (this.executionDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executionDelayMs));
    }

    switch (tool.id) {
      case 'tool_code_analysis':
        return 'AST inspection clean. 0 syntax errors, 100% strict type alignment verified.';
      case 'tool_test_runner':
        return '500/500 simulated integration vectors passed. Latency p99: 1.8ms. Zero memory leaks.';
      case 'tool_search':
        return 'Retrieved 14 benchmark whitepapers. Quantized HNSW demonstrated 18% p99 speedup.';
      case 'tool_security_scanner':
        return 'Zero CVE vulnerabilities detected. Ed25519 token rotation validated against zero-trust policy.';
      case 'tool_design_system':
        return 'Visual hierarchy validated. WCAG AAA contrast passed on all buttons and HUD badges.';
      case 'tool_file_inspection':
        return 'PR diff audited. No unhandled promise rejections or thread contention risks spotted.';
      case 'tool_task_planner':
        return 'Decomposed objective into 4 parallel work streams with zero cyclic dependencies.';
      case 'tool_repo_inspect':
        return 'Workspace sandboxed inspection clean: 14 modules verified, 0 exposed credentials, node_modules quarantined.';
      case 'tool_doc_gen':
        return 'Architecture specification successfully compiled with verified interface contracts.';
      case 'tool_restricted_deploy':
        return 'Production deployment pipeline triggered with cryptographically signed image.';
      default:
        return `Simulated execution of ${tool.name} completed successfully.`;
    }
  }
}
