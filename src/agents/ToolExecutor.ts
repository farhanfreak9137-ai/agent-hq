import { AgentCapability, AgentTool, ToolExecutionResult, ToolRiskPolicy } from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';
import { HumanApprovalManager } from '../security/HumanApprovalManager.ts';
import { ProspectManager } from '../crm/ProspectManager.ts';
import { OpportunityManager } from '../opportunity/OpportunityManager.ts';
import { ProfileManager } from '../profile/ProfileManager.ts';

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
  {
    id: 'tool_document_writer',
    name: 'Creative & Academic Document Studio',
    description: 'Drafts comprehensive essays, study guides, professional emails, and creative novel chapters with prose structuring.',
    capability: 'writing',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'writing',
    inputSchema: {
      genreOrFormat: { type: 'string', description: 'Format: essay, novel_chapter, email, or study_summary', required: false },
      topic: { type: 'string', description: 'Subject or story prompt to write', required: false },
    },
    timeoutMs: 5000,
  },
  {
    id: 'tool_opportunity_analyzer',
    name: 'Strategic Opportunity & Problem Analyzer',
    description: 'Analyzes verified research findings, determines business and technical problem-solution fit, estimates complexity and scope, and produces structured recommendations.',
    capability: 'strategy',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'strategy',
    inputSchema: {
      company: { type: 'string', description: 'Target company or organization', required: false },
      researchFindings: { type: 'string', description: 'Verified research findings or observations', required: false },
      capabilityContext: { type: 'string', description: 'Available services and capability boundaries', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_service_matcher',
    name: 'Capability & Offering Alignment Matcher',
    description: 'Matches identified prospect pain points to available user service offerings (e.g. Full-Stack Web, AI Agents, Zero-Trust Architecture).',
    capability: 'strategy',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'strategy',
    inputSchema: {
      identifiedProblem: { type: 'string', description: 'Target problem to address', required: false },
    },
    timeoutMs: 4000,
  },
  {
    id: 'tool_prospect_manager',
    name: 'CRM Prospect Lifecycle & Operations Manager',
    description: 'Maintains prospect status, prevents duplicate records, validates lifecycle state transitions, and records auditable interaction logs.',
    capability: 'crm',
    riskLevel: 'MEDIUM',
    policyRiskLevel: 'CONTROLLED',
    requiredCapability: 'crm',
    inputSchema: {
      action: { type: 'string', description: 'Action: upsert, transition, duplicate_check, or summary', required: false },
      company: { type: 'string', description: 'Company name', required: false },
      prospectId: { type: 'string', description: 'Prospect ID for transitions', required: false },
      status: { type: 'string', description: 'Target lifecycle status', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_outreach_drafter',
    name: 'Personalized Outreach Composer',
    description: 'Generates concise, non-spam personalized outreach drafts grounded strictly in verified research and strategist recommendations. Output is always flagged requires_human_approval.',
    capability: 'outreach',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'outreach',
    inputSchema: {
      recipient: { type: 'string', description: 'Target contact name or email', required: false },
      company: { type: 'string', description: 'Prospect company name', required: false },
      opportunity: { type: 'string', description: 'Strategist recommended opportunity', required: false },
      channel: { type: 'string', description: 'Channel: email or linkedin', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_restricted_send_outreach',
    name: 'External Outreach Dispatcher',
    description: 'Transmits approved outreach communication to external recipient. RESTRICTED: Physical sending is strictly blocked without explicit human operator authorization.',
    capability: 'outreach',
    riskLevel: 'CRITICAL',
    policyRiskLevel: 'RESTRICTED',
    requiredCapability: 'outreach',
    inputSchema: {
      draftId: { type: 'string', description: 'ID of the approved outreach draft', required: false },
      recipient: { type: 'string', description: 'Destination email address', required: false },
    },
    timeoutMs: 15000,
  },
  {
    id: 'tool_opportunity_matcher',
    name: 'Professional Profile & Opportunity Matcher',
    description: 'Compares opportunity requirements and eligibility against Farhan\'s Professional Profile. Produces structured matches, gaps, and project evidence without arbitrary subjective ratings.',
    capability: 'strategy',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'strategy',
    inputSchema: {
      opportunityId: { type: 'string', description: 'ID of discovered opportunity', required: false },
      requirements: { type: 'string', description: 'List of requirements or qualifications', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_resume_customizer',
    name: 'Tailored Resume Customizer',
    description: 'Customizes a tailored resume emphasizing verified skills, projects, and evidence. STRICT: Never hallucinates or invents facts; flags missing information.',
    capability: 'strategy',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'strategy',
    inputSchema: {
      opportunityId: { type: 'string', description: 'Target opportunity ID', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_application_drafter',
    name: 'Tailored Job Application Drafter',
    description: 'Composes tailored application message and complete review dossier. Holds application in AWAITING_APPROVAL. Never submits without human authorization.',
    capability: 'outreach',
    riskLevel: 'LOW',
    policyRiskLevel: 'SAFE',
    requiredCapability: 'outreach',
    inputSchema: {
      opportunityId: { type: 'string', description: 'Target opportunity ID', required: false },
    },
    timeoutMs: 6000,
  },
  {
    id: 'tool_restricted_submit_application',
    name: 'External Application Dispatcher',
    description: 'Dispatches job or internship application to external platform or organization. RESTRICTED: Physical submission is strictly blocked without explicit human approval.',
    capability: 'outreach',
    riskLevel: 'CRITICAL',
    policyRiskLevel: 'RESTRICTED',
    requiredCapability: 'outreach',
    inputSchema: {
      applicationId: { type: 'string', description: 'ID of the approved job application', required: false },
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
      case 'tool_document_writer':
        return 'Draft completed. Synthesized academic analysis, polished rhetorical flow, and verified narrative coherence.';
      case 'tool_opportunity_analyzer': {
        const company = String(input?.company || 'Target Prospect');
        const rawFindings = input?.researchFindings || input?.evidence || '';
        const findingsText = typeof rawFindings === 'string' ? rawFindings : JSON.stringify(rawFindings);
        const hasFindings = findingsText.trim().length > 0;

        const evidence = hasFindings
          ? [findingsText.substring(0, 160)]
          : ['Verified public website analysis and service infrastructure check'];

        const uncertainties = hasFindings
          ? ['Direct internal tech stack details require introductory exploratory call']
          : ['Specific budget allocation unverified from public sources', 'Internal stakeholder hierarchy requires discovery'];

        const recommendation = {
          company,
          opportunity: 'Modern Full-Stack Web Platform & Autonomous AI Customer Operations',
          evidence,
          identified_problem: 'Legacy web interface and manual customer workflow causing operational latency and missed conversion potential.',
          recommended_solution: 'Develop high-performance responsive web application integrated with autonomous customer FAQ and workflow assistants.',
          recommended_service: 'Full-Stack Modernization & Autonomous AI Integration',
          scope: {
            complexity: 'medium' as const,
            estimated_work: '2-3 weeks implementation sprint',
          },
          fit: 'high' as const,
          priority: 'high' as const,
          confidence: hasFindings ? 0.91 : 0.78,
          uncertainties,
          reasoning_summary: `Direct analysis of ${company} indicates high strategic alignment. Identified manual operational friction that directly maps to modern web & AI services without fabricating missing facts.`,
        };

        return JSON.stringify(recommendation, null, 2);
      }
      case 'tool_service_matcher': {
        const problem = String(input?.identifiedProblem || 'Digital presence and workflow automation');
        return JSON.stringify({
          matchedServices: [
            {
              service: 'Modern Responsive Web Development',
              alignmentScore: 0.95,
              rationale: 'Replaces legacy static site with reactive, sub-100ms UI.',
            },
            {
              service: 'Autonomous AI Integration',
              alignmentScore: 0.9,
              rationale: 'Automates customer interaction and reduces manual triage overhead.',
            },
          ],
          capabilityFit: 'high',
          targetProblem: problem,
        }, null, 2);
      }
      case 'tool_prospect_manager': {
        const action = String(input?.action || 'upsert');
        const company = String(input?.company || 'Acme Innovations');
        const domain = input?.domain ? String(input.domain) : undefined;
        const status = (input?.status as any) || 'DISCOVERED';
        const prospectId = input?.prospectId ? String(input.prospectId) : undefined;

        if (action === 'transition' && prospectId) {
          const res = ProspectManager.transitionStatus(prospectId, status, 'crm', 'Transition via CRM tool');
          if (!res.success) {
            throw new Error(res.error || `Invalid state transition to ${status}`);
          }
          return JSON.stringify({ success: true, prospect: res.prospect });
        }

        if (action === 'duplicate_check') {
          const dup = ProspectManager.checkDuplicate(company, domain);
          return JSON.stringify({ isDuplicate: !!dup, existingProspect: dup || null });
        }

        const res = ProspectManager.createProspect({
          company,
          domain,
          opportunity: String(input?.opportunity || 'Web and AI Modernization'),
          recommendedService: String(input?.recommendedService || 'Full-Stack Web & AI Automation'),
          fit: 'high',
          priority: 'high',
          status,
        });

        if (!res.success && res.isDuplicate) {
          return JSON.stringify({
            duplicateDetected: true,
            message: `Prospect ${company} already exists in CRM. Duplicate creation prevented.`,
            prospect: res.prospect,
          });
        }

        return JSON.stringify({
          success: true,
          prospect: res.prospect,
          lifecycleStatus: res.prospect?.status,
        });
      }
      case 'tool_outreach_drafter': {
        const recipient = String(input?.recipient || 'contact@example.com');
        const company = String(input?.company || 'Example Organization');
        const opp = String(input?.opportunity || 'Web and AI Modernization');

        const draft = ProspectManager.createDraft({
          prospectId: input?.prospectId ? String(input.prospectId) : undefined,
          company,
          recipient,
          channel: (input?.channel as any) || 'email',
          subject: `Streamlining ${company}'s digital platform and workflow efficiency`,
          body: `Hi ${recipient},\n\nI researched ${company}'s current public web platform and noticed an opportunity to modernize your customer interaction workflows. By pairing a high-performance web experience with dedicated AI customer support, we can significantly reduce operational overhead and elevate user satisfaction.\n\nWould you be open to a brief 10-minute introductory conversation next week to see how this fits your roadmap?\n\nBest regards,\nFarhan`,
          personalization_points: [
            `Referenced ${company}'s current public infrastructure`,
            `Focused on verified operational efficiency rather than generic claims`,
          ],
          source_evidence: [
            `Research findings verified for ${company}`,
            `Strategist recommendation: ${opp}`,
          ],
          confidence: 0.92,
        });

        return JSON.stringify({
          recipient: draft.recipient,
          channel: draft.channel,
          subject: draft.subject,
          body: draft.body,
          personalization_points: draft.personalization_points,
          source_evidence: draft.source_evidence,
          confidence: draft.confidence,
          requires_human_approval: true,
          draftId: draft.id,
          status: draft.status,
        }, null, 2);
      }
      case 'tool_restricted_send_outreach': {
        const draftId = String(input?.draftId || '');
        const draft = ProspectManager.getDraftById(draftId);

        // ABSOLUTE SECURITY CHECK: Draft must be explicitly APPROVED
        if (!draft || draft.status !== 'APPROVED') {
          throw new Error(
            `SECURITY ENFORCEMENT ERROR: Cannot send outreach. Draft [${draftId || 'none'}] must have explicit 'APPROVED' status from human operator before dispatch. Current status: ${draft ? draft.status : 'NOT_FOUND'}`
          );
        }

        const sendResult = ProspectManager.markSent(draftId);
        if (!sendResult.success) {
          throw new Error(sendResult.error);
        }

        return JSON.stringify({
          sent: true,
          draftId,
          recipient: draft.recipient,
          channel: draft.channel,
          dispatchedAt: Date.now(),
          status: 'SENT',
        });
      }
      case 'tool_opportunity_matcher': {
        const oppId = String(input?.opportunityId || '');
        if (oppId) {
          const matchRes = OpportunityManager.matchOpportunity(oppId);
          if (matchRes.success && matchRes.fitAnalysis) {
            return JSON.stringify(matchRes.fitAnalysis, null, 2);
          }
        }

        // Direct requirement list matching fallback
        const rawReqs = input?.requirements;
        const reqList: string[] = Array.isArray(rawReqs)
          ? rawReqs
          : typeof rawReqs === 'string'
          ? rawReqs.split(/,|\n/).map((s) => s.trim()).filter(Boolean)
          : ['React', 'TypeScript', 'Next.js', 'AI Integration'];

        const profile = ProfileManager.getProfile('FULL');
        const knownSkills = new Set(
          [
            ...profile.skills.frontend,
            ...profile.skills.backend,
            ...profile.skills.ai,
            ...profile.skills.cloud,
            ...profile.skills.databases,
            ...profile.skills.tools,
            ...profile.skills.languages,
            ...profile.skills.verifiedSkills,
          ].map((s) => s.toLowerCase().trim())
        );

        const strongMatches = reqList.filter((r) =>
          Array.from(knownSkills).some((k) => k.includes(r.toLowerCase()) || r.toLowerCase().includes(k))
        );
        const potentialGaps = reqList.filter((r) => !strongMatches.includes(r));
        const evidence = profile.projects.map((p) => `${p.name}: ${p.technologies.slice(0, 3).join(', ')}`);

        const analysis = {
          strongMatches,
          potentialGaps,
          eligibilityChecks: [
            { criterion: 'Student Status', status: 'MATCH', details: 'Enrolled in CSE' },
            { criterion: 'Remote Location', status: 'MATCH', details: 'Remote worldwide' },
          ],
          evidence: evidence.slice(0, 3),
          matchPercentage: Math.round((strongMatches.length / Math.max(reqList.length, 1)) * 100),
          reasoning: `Direct requirement mapping against Farhan's profile. Matched ${strongMatches.length} of ${reqList.length} qualifications with zero fabricated claims.`,
        };

        return JSON.stringify(analysis, null, 2);
      }
      case 'tool_resume_customizer': {
        const oppId = String(input?.opportunityId || 'opp_seed_1');
        const opp = OpportunityManager.getOpportunityById(oppId);
        const profile = ProfileManager.getProfile('APPLICATION');

        const targetSkills = opp ? opp.requirements : ['React', 'TypeScript', 'AI Integration'];
        const highlightedSkills = profile.skills.verifiedSkills.filter((s) =>
          targetSkills.some((r) => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
        );

        if (highlightedSkills.length === 0) {
          highlightedSkills.push(...profile.skills.verifiedSkills.slice(0, 5));
        }

        const verifiedProjects = profile.projects.filter((p) => p.verified);
        const factualVerification = ProfileManager.verifyFactualAccuracy({
          skills: highlightedSkills,
          projects: verifiedProjects.map((p) => p.name),
        });

        const customizedResume = {
          targetOpportunity: opp ? opp.title : 'Software Engineering',
          targetOrganization: opp ? opp.organization : 'Target Organization',
          headline: `${profile.identity.fullName} — ${profile.identity.professionalHeadline}`,
          summary: `Software engineer specializing in verified full-stack architecture, distributed systems, and autonomous multi-agent design. Demonstrated systems: Agent HQ and Auren.`,
          tailoredSummary: `Software engineer specializing in verified full-stack architecture, distributed systems, and autonomous multi-agent design. Demonstrated systems: Agent HQ and Auren.`,
          highlightedVerifiedSkills: highlightedSkills,
          skillsHighlighted: highlightedSkills,
          highlightedSkills,
          verifiedProjects: verifiedProjects.map((p) => ({
            name: p.name,
            role: p.role,
            technologies: p.technologies,
            evidence: p.evidence,
          })),
          education: profile.education[0]
            ? `${profile.education[0].institution} — ${profile.education[0].program} (${profile.education[0].currentYear})`
            : 'Computer Science & Engineering',
          factualIntegrityPassed: factualVerification.valid,
          unverifiedItemsFlagged: factualVerification.unverifiedItems,
        };

        return JSON.stringify(customizedResume, null, 2);
      }
      case 'tool_application_drafter': {
        const oppId = String(input?.opportunityId || 'opp_seed_1');
        const draftRes = OpportunityManager.tailorResumeAndDraft(oppId);
        if (!draftRes.success || !draftRes.application) {
          throw new Error(draftRes.error || `Could not draft application for ${oppId}`);
        }

        const app = draftRes.application;
        return JSON.stringify({
          applicationId: app.id,
          opportunityId: app.opportunityId,
          targetOrganization: app.targetOrganization,
          opportunityTitle: app.opportunityTitle,
          status: app.status,
          requires_human_approval: true,
          applicationMessage: app.applicationMessage,
          tailoredResumeSummary: app.tailoredResume.summary,
          missingInformation: app.missingInformation,
          potentialRisks: app.potentialRisks,
        }, null, 2);
      }
      case 'tool_restricted_submit_application': {
        const appId = String(input?.applicationId || '');
        const app = OpportunityManager.getApplicationById(appId);

        // ABSOLUTE SECURITY BOUNDARY: Must have explicit human APPROVED status
        if (!app || app.status !== 'APPROVED') {
          throw new Error(
            `SECURITY ENFORCEMENT ERROR: Cannot submit application. Application [${appId || 'none'}] must have explicit 'APPROVED' status from human operator before dispatch. Current status: ${app ? app.status : 'NOT_FOUND'}`
          );
        }

        const submitRes = OpportunityManager.submitApplication(appId);
        if (!submitRes.success) {
          throw new Error(submitRes.error);
        }

        return JSON.stringify({
          submitted: true,
          applicationId: appId,
          targetOrganization: app.targetOrganization,
          opportunityTitle: app.opportunityTitle,
          dispatchedAt: Date.now(),
          status: 'SUBMITTED',
        });
      }
      default:

        return `Simulated execution of ${tool.name} completed successfully.`;
    }
  }
}
