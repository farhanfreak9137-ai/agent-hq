import {
  AgentContext,
  AgentModel,
  AgentTool,
  TaskModel,
  MessageModel,
  MemoryEntry,
  ProviderCapability,
} from '../types/index.ts';
import { LayeredMemory } from '../memory/LayeredMemory.ts';

export interface BuildContextOptions {
  agent: AgentModel;
  currentTask?: TaskModel;
  layeredMemory?: LayeredMemory;
  availableTools?: AgentTool[];
  recentMessages?: MessageModel[];
  taskHistory?: Array<{ taskId: string; title: string; success: boolean }>;
  dependencyResults?: Record<string, unknown>;
  providerCapabilities?: ProviderCapability[];
  missionContext?: { missionId: string; title: string; phase?: string };
  maxMemories?: number;
  maxMessages?: number;
  maxHistory?: number;
}

/**
 * AgentContextBuilder constructs a bounded, highly relevant prompt context
 * preventing context overflow and token bloat while ensuring models have
 * complete mission awareness, dependency outputs, and memories.
 */
export class AgentContextBuilder {
  public static build(options: BuildContextOptions): AgentContext {
    const maxMemories = options.maxMemories ?? 5;
    const maxMessages = options.maxMessages ?? 5;
    const maxHistory = options.maxHistory ?? 4;

    // 1. Retrieve most relevant memories if layered memory is available
    let relevantMemories: MemoryEntry[] = [];
    if (options.layeredMemory) {
      const query = options.currentTask
        ? `${options.currentTask.title} ${options.currentTask.description}`
        : `${options.agent.role} ${options.agent.personality}`;
      const scored = options.layeredMemory.queryRelevant(query, maxMemories);
      relevantMemories = scored.map((s) => s.entry);
    }

    // 2. Bound recent messages to target agent
    const recentMessages = (options.recentMessages || [])
      .filter((m) => m.toAgentId === options.agent.id || m.fromAgentId === options.agent.id)
      .slice(-maxMessages);

    // 3. Bound task history
    const taskHistory = (options.taskHistory || []).slice(-maxHistory);

    // 4. Bound available tools to those matching agent capabilities & permissions
    const agentCaps = new Set(options.agent.capabilities || []);
    const availableTools = (options.availableTools || []).filter((t) => {
      const req = t.requiredCapability || t.capability;
      return !req || agentCaps.has(req) || options.agent.role === 'Orchestrator';
    });

    return {
      agentId: options.agent.id,
      agentName: options.agent.name,
      role: options.agent.role,
      systemRole: options.agent.systemRole || options.agent.description,
      capabilities: [...(options.agent.capabilities || [])],
      currentTask: options.currentTask,
      taskHistory,
      relevantMemories,
      availableTools,
      recentMessages,
      dependencyResults: options.dependencyResults || {},
      providerCapabilities: options.providerCapabilities || ['task_execution', 'tool_execution'],
      missionContext: options.missionContext,
    };
  }

  /**
   * Format the structured AgentContext into a sanitized, bounded system prompt block.
   */
  public static formatForPrompt(ctx: AgentContext): string {
    const lines: string[] = [];
    lines.push(`AGENT IDENTITY: ${ctx.agentName} (${ctx.role})`);
    lines.push(`DIRECTIVE: ${ctx.systemRole}`);
    lines.push(`CAPABILITIES: ${ctx.capabilities.join(', ')}`);

    if (ctx.missionContext) {
      lines.push(`MISSION: "${ctx.missionContext.title}" (ID: ${ctx.missionContext.missionId})`);
    }

    if (ctx.currentTask) {
      lines.push(`CURRENT TASK: "${ctx.currentTask.title}"`);
      if (ctx.currentTask.description) {
        lines.push(`TASK OBJECTIVE: ${ctx.currentTask.description}`);
      }
    }

    if (Object.keys(ctx.dependencyResults).length > 0) {
      lines.push(`UPSTREAM DEPENDENCY DELIVERABLES:`);
      for (const [depId, res] of Object.entries(ctx.dependencyResults)) {
        lines.push(`  - [${depId}]: ${JSON.stringify(res).substring(0, 200)}`);
      }
    }

    if (ctx.relevantMemories.length > 0) {
      lines.push(`RELEVANT MEMORIES:`);
      for (const mem of ctx.relevantMemories) {
        lines.push(`  - [${mem.type}]: ${mem.content}`);
      }
    }

    if (ctx.availableTools.length > 0) {
      lines.push(`AVAILABLE TOOLS: ${ctx.availableTools.map((t) => t.name).join(', ')}`);
    }

    return lines.join('\n');
  }
}
