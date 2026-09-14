import { TaskGraph } from './TaskGraph.ts';
import { InitiativeDefinition, AgentRole, AgentCapability } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { AgentManager } from '../agents/AgentManager.ts';

/**
 * Enterprise TaskPlanner:
 * - Deconstructs mission goals into validated DAG task topologies
 * - Dynamic capability-based agent matching
 * - Supports parallel competing solutions pattern
 * - Integrates peer reviews and zero-trust security bounds
 */
export class TaskPlanner {
  private static readonly ROLE_AGENT_MAP: Record<string, string> = {
    Orchestrator: 'boss',
    Coder: 'nova',
    Researcher: 'atlas',
    Designer: 'pixel',
    Reviewer: 'echo',
    Tester: 'vector',
    'Security Engineer': 'sentinel',
  };

  /**
   * Recommend agent based on capability matching and current workload.
   */
  public recommendAgentForCapabilities(requiredCapabilities: AgentCapability[]): string {
    const allAgents = AgentManager.getAll();
    let bestAgentId = 'boss';
    let bestScore = -1;

    for (const agent of allAgents) {
      const caps = new Set(agent.capabilities || []);
      let score = 0;
      for (const req of requiredCapabilities) {
        if (caps.has(req)) score += 2;
      }
      // Idle agent bonus
      if (agent.status === 'IDLE') score += 1;

      if (score > bestScore) {
        bestScore = score;
        bestAgentId = agent.id;
      }
    }

    return bestAgentId;
  }

  /**
   * Plans and constructs a verified TaskGraph from an initiative specification.
   */
  public planInitiative(initiative: InitiativeDefinition): TaskGraph {
    const graph = new TaskGraph(
      generateId('graph'),
      initiative.title,
      initiative.id
    );

    if (initiative.phases && initiative.phases.length > 0) {
      let previousPhaseTaskIds: string[] = [];

      for (const phase of initiative.phases) {
        const currentPhaseTaskIds: string[] = [];

        for (const taskDef of phase.tasks) {
          const assignedAgent = this.recommendAgentForRole(taskDef.role);
          const taskId = generateId('task');

          const dependencies = taskDef.dependencies && taskDef.dependencies.length > 0
            ? [...taskDef.dependencies]
            : [...previousPhaseTaskIds];

          graph.addNode({
            id: taskDef.id,
            taskId,
            title: taskDef.title,
            description: taskDef.description,
            assignedAgentId: assignedAgent,
            dependencies,
            dependents: [],
            status: 'pending',
            retryCount: 0,
            maxRetries: 2,
          });

          currentPhaseTaskIds.push(taskDef.id);
        }

        for (const taskId of currentPhaseTaskIds) {
          const node = graph.getNode(taskId);
          if (node) {
            for (const depId of node.dependencies) {
              if (graph.getNode(depId)) {
                graph.addEdge(depId, taskId);
              }
            }
          }
        }

        previousPhaseTaskIds = currentPhaseTaskIds;
      }
    }

    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Generated TaskGraph is invalid: ${validation.errors.join('; ')}`);
    }

    return graph;
  }

  /**
   * Competing Solutions Plan (Step 23):
   * NOVA creates Solution A (Memory-mapped cache)
   * ATLAS creates Solution B (Quantized in-memory index)
   * ECHO performs comparative peer review & trade-off benchmarking
   * BOSS selects and synthesizes the optimal architecture
   */
  public createCompetingSolutionsPlan(): TaskGraph {
    const graph = new TaskGraph(
      generateId('graph_competing'),
      'Parallel Competing Architecture Evaluation',
      'initiative_competing_eval'
    );

    // Root node: BOSS specifications
    graph.addNode({
      id: 'node_comp_specs',
      taskId: generateId('task'),
      title: 'High-Throughput State Indexing Requirements',
      description: 'BOSS formulates latency bounds and consistency trade-offs for 100k req/sec cache.',
      assignedAgentId: 'boss',
      dependencies: [],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    // Competing Stream A: NOVA Memory-Mapped Buffer
    graph.addNode({
      id: 'node_sol_a',
      taskId: generateId('task'),
      title: 'Solution A: Zero-Copy Ring Buffer Architecture',
      description: 'NOVA compiles memory-mapped lockless ring buffer with constant-time writes.',
      assignedAgentId: 'nova',
      dependencies: ['node_comp_specs'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Competing Stream B: ATLAS Quantized Vector Cache
    graph.addNode({
      id: 'node_sol_b',
      taskId: generateId('task'),
      title: 'Solution B: Quantized Distributed Key-Value Store',
      description: 'ATLAS structures partitioned key-value topology with snappy compression.',
      assignedAgentId: 'atlas',
      dependencies: ['node_comp_specs'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Peer Review & Benchmark Comparison: ECHO
    graph.addNode({
      id: 'node_comp_review',
      taskId: generateId('task'),
      title: 'Comparative Benchmark & Trade-off Matrix',
      description: 'ECHO audits latency profiles, p99 tail bounds, and concurrency race conditions.',
      assignedAgentId: 'echo',
      dependencies: ['node_sol_a', 'node_sol_b'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Final Synthesis: BOSS
    graph.addNode({
      id: 'node_comp_synthesis',
      taskId: generateId('task'),
      title: 'Architectural Selection & Hybrid Synthesis',
      description: 'BOSS selects winning strategy and synthesizes final unified implementation plan.',
      assignedAgentId: 'boss',
      dependencies: ['node_comp_review'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    graph.addEdge('node_comp_specs', 'node_sol_a');
    graph.addEdge('node_comp_specs', 'node_sol_b');
    graph.addEdge('node_sol_a', 'node_comp_review');
    graph.addEdge('node_sol_b', 'node_comp_review');
    graph.addEdge('node_comp_review', 'node_comp_synthesis');

    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Competing plan validation failed: ${validation.errors.join('; ')}`);
    }

    return graph;
  }

  /**
   * Creates the definitive "Operation Aegis" zero-trust authentication architecture DAG.
   */
  public createOperationAegisPlan(): TaskGraph {
    const graph = new TaskGraph(
      'dag_aegis',
      'Operation Aegis: Zero-Trust Authentication Architecture',
      'initiative_aegis'
    );

    // Root Phase 0: Mission Synthesis (BOSS)
    graph.addNode({
      id: 'node_synthesis',
      taskId: 'task_aegis_synthesis',
      title: 'Mission Synthesis & Architecture Specifications',
      description: 'BOSS deconstructs zero-trust mandate into cryptographic and operational streams.',
      assignedAgentId: 'boss',
      dependencies: [],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    // Phase 1: Parallel Execution across 4 streams (SENTINEL, NOVA, PIXEL, ATLAS)
    graph.addNode({
      id: 'node_crypto_spec',
      taskId: 'task_aegis_crypto_spec',
      title: 'Cryptographic Security Bounds & Threat Modeling',
      description: 'SENTINEL formulates zero-trust specifications and CVE threat vectors.',
      assignedAgentId: 'sentinel',
      dependencies: ['node_synthesis'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    graph.addNode({
      id: 'node_token_impl',
      taskId: 'task_aegis_token_impl',
      title: 'Ed25519 Token Signing & Constant-Time Tables',
      description: 'NOVA compiles cryptographic session rotation with zero-memory-leak guarantees.',
      assignedAgentId: 'nova',
      dependencies: ['node_synthesis'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    graph.addNode({
      id: 'node_ui_specs',
      taskId: 'task_aegis_ui_specs',
      title: 'Multi-Factor Biometric HUD & Modal Design',
      description: 'PIXEL crafts seamless zero-trust authentication layout and token rotation HUD.',
      assignedAgentId: 'pixel',
      dependencies: ['node_synthesis'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    graph.addNode({
      id: 'node_cve_research',
      taskId: 'task_aegis_cve_research',
      title: 'Industry Vulnerability & Compliance Intelligence',
      description: 'ATLAS indexes National Vulnerability Database against crypto dependencies.',
      assignedAgentId: 'atlas',
      dependencies: ['node_synthesis'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Phase 2: Architectural Code Audit (ECHO)
    graph.addNode({
      id: 'node_code_audit',
      taskId: 'task_aegis_code_audit',
      title: 'Rigorous Architectural Code Audit (PR #501)',
      description: 'ECHO audits token rotation routines, constant-time comparisons, and race safety.',
      assignedAgentId: 'echo',
      dependencies: ['node_token_impl', 'node_crypto_spec'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Phase 3: Automated Chaos & Fuzz Testing (VECTOR)
    graph.addNode({
      id: 'node_chaos_fuzz',
      taskId: 'task_aegis_chaos_fuzz',
      title: 'Automated 5,000-Handshake Chaos Penetration Test',
      description: 'VECTOR floods zero-trust session endpoints with fuzzing vectors to detect memory leaks.',
      assignedAgentId: 'vector',
      dependencies: ['node_code_audit'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 2,
    });

    // Phase 4: Security Certification Sign-off (SENTINEL)
    graph.addNode({
      id: 'node_security_signoff',
      taskId: 'task_aegis_security_signoff',
      title: 'Final Cryptographic Certification & Sign-off',
      description: 'SENTINEL generates zero-vulnerability audit certificate and grants deployment clearance.',
      assignedAgentId: 'sentinel',
      dependencies: ['node_chaos_fuzz'],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    // Connect edges
    graph.addEdge('node_synthesis', 'node_crypto_spec');
    graph.addEdge('node_synthesis', 'node_token_impl');
    graph.addEdge('node_synthesis', 'node_ui_specs');
    graph.addEdge('node_synthesis', 'node_cve_research');

    graph.addEdge('node_token_impl', 'node_code_audit');
    graph.addEdge('node_crypto_spec', 'node_code_audit');

    graph.addEdge('node_code_audit', 'node_chaos_fuzz');
    graph.addEdge('node_chaos_fuzz', 'node_security_signoff');

    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Aegis plan validation failed: ${validation.errors.join('; ')}`);
    }

    return graph;
  }

  public createArchitectureAnalysisGraph(targetAgentId: string = 'nova'): TaskGraph {
    const graph = new TaskGraph(
      generateId('graph'),
      'Architecture Analysis Smoke Test',
      'initiative-smoke-architecture'
    );

    graph.addNode({
      id: 'node_arch_analysis',
      taskId: 'task_smoke_arch_analysis',
      title: 'Analyze Agent HQ repository architecture',
      description: 'Analyze the Agent HQ repository architecture and return a concise summary of the main runtime/provider/orchestration layers.',
      assignedAgentId: targetAgentId,
      dependencies: [],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Smoke plan validation failed: ${validation.errors.join('; ')}`);
    }

    return graph;
  }

  /**
   * Dynamically plans and decomposes a free-form mission goal into a multi-agent DAG.
   */
  /**
   * Intelligently decompose any user-provided goal by analyzing domain keywords,
   * determining which specialist agents are needed, and constructing an optimal dynamic DAG.
   */
  public decomposeGoal(goal: string, description?: string): TaskGraph {
    const graph = new TaskGraph(
      generateId('graph'),
      goal,
      generateId('init')
    );

    const fullText = `${goal} ${description || ''}`.toLowerCase();

    // 1. Detect required specialist domains
    const needsResearch = /research|analyze|analysis|investigate|benchmark|competitor|market|docs|documentation|spec|find|explore|evaluate|study|papers|survey/.test(fullText);
    const needsDesign = /design|ui|ux|frontend|css|layout|color|theme|style|visual|landing|component|button|interface|mockup|responsive/.test(fullText);
    const needsCoding = /code|implement|build|create|develop|refactor|fix|bug|api|endpoint|backend|database|module|function|service|logic|feature|algorithm|script|handler|pipeline|patch/.test(fullText);
    const needsSecurity = /security|audit|vulnerability|cve|auth|token|jwt|encryption|cipher|firewall|zero-trust|permission|sanitize|leak|exploit|penetration|secret/.test(fullText);
    const needsTesting = /test|testing|qa|fuzz|stress|e2e|unit|integration|coverage|chaos|benchmark|load|validate|regression/.test(fullText);
    const needsReview = /review|pr|pull request|inspect|gatekeeper|standards|compliance|quality|lint|verify/.test(fullText);

    // If nothing specific matched, default to a balanced software development flow (Coding + Testing + Review)
    const hasAnySpecialist = needsResearch || needsDesign || needsCoding || needsSecurity || needsTesting || needsReview;
    const useResearch = needsResearch || !hasAnySpecialist;
    const useDesign = needsDesign;
    const useCoding = needsCoding || !hasAnySpecialist;
    const useSecurity = needsSecurity;
    const useTesting = needsTesting || (!needsSecurity && !needsResearch && !needsDesign);
    const useReview = needsReview || useCoding;

    // Phase 0: Root - BOSS Strategy & Scope Definition
    const rootId = 'node_scope_' + generateId('n');
    graph.addNode({
      id: rootId,
      taskId: generateId('task'),
      title: `Scope & Strategy: ${goal.substring(0, 40)}`,
      description: `BOSS evaluates requirements, determines required specialists, and defines boundaries for: ${description || goal}`,
      assignedAgentId: 'boss',
      dependencies: [],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });

    let currentDependencies: string[] = [rootId];

    // Phase 1: Discovery & Analysis (ATLAS / PIXEL)
    const discoveryNodes: string[] = [];

    if (useResearch) {
      const researchId = 'node_research_' + generateId('n');
      graph.addNode({
        id: researchId,
        taskId: generateId('task'),
        title: `Research & Requirements Discovery`,
        description: `ATLAS investigates domain specifications, dependencies, and state documentation for "${goal}".`,
        assignedAgentId: 'atlas',
        dependencies: [rootId],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      });
      graph.addEdge(rootId, researchId);
      discoveryNodes.push(researchId);
    }

    if (useDesign) {
      const designId = 'node_design_' + generateId('n');
      graph.addNode({
        id: designId,
        taskId: generateId('task'),
        title: `UI/UX Architecture & Layout Formulations`,
        description: `PIXEL formulates component layouts, responsive structures, and design tokens for "${goal}".`,
        assignedAgentId: 'pixel',
        dependencies: [rootId],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      });
      graph.addEdge(rootId, designId);
      discoveryNodes.push(designId);
    }

    if (discoveryNodes.length > 0) {
      currentDependencies = discoveryNodes;
    }

    // Phase 2: Technical Implementation (NOVA)
    const executionNodes: string[] = [];

    if (useCoding) {
      const implId = 'node_impl_' + generateId('n');
      graph.addNode({
        id: implId,
        taskId: generateId('task'),
        title: `Technical Implementation & Engineering`,
        description: `NOVA implements core logic, robust types, error handling, and API integration for "${goal}".`,
        assignedAgentId: 'nova',
        dependencies: [...currentDependencies],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      });
      for (const depId of currentDependencies) {
        graph.addEdge(depId, implId);
      }
      executionNodes.push(implId);
    }

    if (executionNodes.length > 0) {
      currentDependencies = executionNodes;
    }

    // Phase 3: Verification, Security & QA (SENTINEL / VECTOR)
    const verificationNodes: string[] = [];

    if (useSecurity) {
      const secId = 'node_sec_' + generateId('n');
      graph.addNode({
        id: secId,
        taskId: generateId('task'),
        title: `Zero-Trust Security & Vulnerability Audit`,
        description: `SENTINEL inspects cryptographic boundaries, CVEs, and input sanitization for "${goal}".`,
        assignedAgentId: 'sentinel',
        dependencies: [...currentDependencies],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      });
      for (const depId of currentDependencies) {
        graph.addEdge(depId, secId);
      }
      verificationNodes.push(secId);
    }

    if (useTesting) {
      const testId = 'node_test_' + generateId('n');
      graph.addNode({
        id: testId,
        taskId: generateId('task'),
        title: `Resilience & Automated Test Verification`,
        description: `VECTOR executes test runners, boundary fuzzing, and stress assertions for "${goal}".`,
        assignedAgentId: 'vector',
        dependencies: [...currentDependencies],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
      });
      for (const depId of currentDependencies) {
        graph.addEdge(depId, testId);
      }
      verificationNodes.push(testId);
    }

    if (verificationNodes.length > 0) {
      currentDependencies = verificationNodes;
    }

    // Phase 4: Peer Review & Quality Gate (ECHO)
    const reviewNodes: string[] = [];

    if (useReview) {
      const reviewId = 'node_review_' + generateId('n');
      graph.addNode({
        id: reviewId,
        taskId: generateId('task'),
        title: `Peer Review & Acceptance Benchmarking`,
        description: `ECHO conducts rigorous code inspection and architectural gatekeeping for "${goal}".`,
        assignedAgentId: 'echo',
        dependencies: [...currentDependencies],
        dependents: [],
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
      });
      for (const depId of currentDependencies) {
        graph.addEdge(depId, reviewId);
      }
      reviewNodes.push(reviewId);
    }

    if (reviewNodes.length > 0) {
      currentDependencies = reviewNodes;
    }

    // Phase 5: BOSS Executive Synthesis
    const synthId = 'node_synth_' + generateId('n');
    graph.addNode({
      id: synthId,
      taskId: generateId('task'),
      title: `Executive Synthesis & Deliverable Compilation`,
      description: `BOSS reviews deliverables from all contributing agents, validates completion, and compiles final mission artifact.`,
      assignedAgentId: 'boss',
      dependencies: [...currentDependencies],
      dependents: [],
      status: 'pending',
      retryCount: 0,
      maxRetries: 1,
    });
    for (const depId of currentDependencies) {
      graph.addEdge(depId, synthId);
    }

    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Dynamic plan validation failed: ${validation.errors.join('; ')}`);
    }

    return graph;
  }

  private recommendAgentForRole(role: AgentRole): string {
    return TaskPlanner.ROLE_AGENT_MAP[role] || 'boss';
  }
}
