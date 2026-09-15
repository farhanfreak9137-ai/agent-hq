import {
  AgentStatus,
  TaskStatus,
  MessageModel,
  Position,
  AgentRuntimeStatus,
  AgentTool,
  ToolExecutionResult,
  ProviderHealth,
  TaskNode,
} from '../types/index.ts';
import { TaskExecutionResult } from '../agents/AgentProvider.ts';

export type SimulationEventType =
  | 'agent.created'
  | 'agent.started'
  | 'agent.state_changed'
  | 'agent.moved'
  | 'agent.task_assigned'
  | 'agent.task_started'
  | 'agent.task_progress'
  | 'agent.task_completed'
  | 'agent.task_failed'
  | 'agent.message_sent'
  | 'agent.message_received'
  | 'agent.error'
  | 'agent.recovered'
  | 'agent.idle'
  | 'runtime.started'
  | 'runtime.thinking'
  | 'runtime.tool_started'
  | 'runtime.tool_completed'
  | 'runtime.progress'
  | 'runtime.completed'
  | 'runtime.failed'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  | 'orchestration.initiative_started'
  | 'orchestration.dag_generated'
  | 'orchestration.task_ready'
  | 'orchestration.task_blocked'
  | 'orchestration.parallel_batch_started'
  | 'orchestration.initiative_completed'
  | 'orchestration.initiative_failed'
  | 'provider.registered'
  | 'provider.health_changed'
  | 'mission.started'
  | 'mission.step'
  | 'mission.completed'
  | 'mission.failed'
  | 'simulation.started'
  | 'simulation.paused'
  | 'simulation.resumed'
  | 'simulation.play'
  | 'simulation.pause'
  | 'simulation.speed'
  | 'simulation.reset'
  | 'strategist.started'
  | 'strategist.completed'
  | 'strategist.failed'
  | 'crm.prospect_created'
  | 'crm.status_changed'
  | 'crm.interaction_recorded'
  | 'outreach.draft_created'
  | 'outreach.reviewed'
  | 'outreach.awaiting_approval'
  | 'outreach.approved'
  | 'outreach.rejected'
  | 'profile.updated'
  | 'profile.approval.requested'
  | 'opportunity.discovered'
  | 'opportunity.verified'
  | 'opportunity.matched'
  | 'application.drafted'
  | 'application.approval.requested'
  | 'application.approved'
  | 'application.rejected'
  | 'application.submitted';

export interface BaseEvent {
  id: string;
  type: SimulationEventType;
  timestamp: number;
  message: string;
}

export interface AgentCreatedEvent extends BaseEvent {
  type: 'agent.created';
  agentId: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentStartedEvent extends BaseEvent {
  type: 'agent.started';
  agentId: string;
}

export interface AgentStateChangedEvent extends BaseEvent {
  type: 'agent.state_changed';
  agentId: string;
  previousStatus?: AgentStatus;
  currentStatus: AgentStatus;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMovedEvent extends BaseEvent {
  type: 'agent.moved';
  agentId: string;
  position: Position;
  facing?: 'up' | 'down' | 'left' | 'right';
}

export interface AgentTaskAssignedEvent extends BaseEvent {
  type: 'agent.task_assigned';
  taskId: string;
  agentId?: string;
  status: TaskStatus;
  priority?: string;
}

export interface AgentTaskStartedEvent extends BaseEvent {
  type: 'agent.task_started';
  taskId: string;
  agentId: string;
}

export interface AgentTaskProgressEvent extends BaseEvent {
  type: 'agent.task_progress';
  taskId: string;
  agentId?: string;
  status: TaskStatus;
  progress: number;
}

export interface AgentTaskCompletedEvent extends BaseEvent {
  type: 'agent.task_completed';
  taskId: string;
  agentId?: string;
  status: 'COMPLETED';
  completedAt: number;
}

export interface AgentTaskFailedEvent extends BaseEvent {
  type: 'agent.task_failed';
  taskId: string;
  agentId?: string;
  status: 'FAILED';
  error: string;
}

export interface AgentMessageSentEvent extends BaseEvent {
  type: 'agent.message_sent';
  messageData: MessageModel;
  sourceAgentId: string;
  targetAgentId: string;
  content: string;
  sourcePosition?: Position;
  targetPosition?: Position;
  accentColor?: string;
}

export interface AgentMessageReceivedEvent extends BaseEvent {
  type: 'agent.message_received';
  messageData: MessageModel;
  sourceAgentId: string;
  targetAgentId: string;
  content: string;
}

export interface AgentErrorEvent extends BaseEvent {
  type: 'agent.error';
  agentId: string;
  error: string;
  code?: string;
}

export interface AgentIdleEvent extends BaseEvent {
  type: 'agent.idle';
  agentId: string;
}

// --- Real Runtime Lifecycle Events ---

export interface RuntimeStartedEvent extends BaseEvent {
  type: 'runtime.started';
  agentId: string;
  taskId?: string;
  runtimeStatus: AgentRuntimeStatus;
}

export interface RuntimeThinkingEvent extends BaseEvent {
  type: 'runtime.thinking';
  agentId: string;
  taskId?: string;
  thought: string;
}

export interface RuntimeToolStartedEvent extends BaseEvent {
  type: 'runtime.tool_started';
  agentId: string;
  taskId?: string;
  tool: AgentTool;
}

export interface RuntimeToolCompletedEvent extends BaseEvent {
  type: 'runtime.tool_completed';
  agentId: string;
  taskId?: string;
  result: ToolExecutionResult;
}

export interface RuntimeProgressEvent extends BaseEvent {
  type: 'runtime.progress';
  agentId: string;
  taskId?: string;
  progress: number;
  statusMessage?: string;
}

export interface RuntimeCompletedEvent extends BaseEvent {
  type: 'runtime.completed';
  agentId: string;
  taskId?: string;
  result: TaskExecutionResult;
}

export interface RuntimeFailedEvent extends BaseEvent {
  type: 'runtime.failed';
  agentId: string;
  taskId?: string;
  error: string;
}

// --- Task Lifecycle Events ---

export interface TaskLifecycleStartedEvent extends BaseEvent {
  type: 'task.started';
  taskId: string;
  agentId: string;
}

export interface TaskLifecycleProgressEvent extends BaseEvent {
  type: 'task.progress';
  taskId: string;
  agentId?: string;
  progress: number;
  status: TaskStatus;
}

export interface TaskLifecycleCompletedEvent extends BaseEvent {
  type: 'task.completed';
  taskId: string;
  agentId?: string;
  result?: TaskExecutionResult;
}

export interface TaskLifecycleFailedEvent extends BaseEvent {
  type: 'task.failed';
  taskId: string;
  agentId?: string;
  error: string;
}

// --- Mission Events ---

export interface MissionStartedEvent extends BaseEvent {
  type: 'mission.started';
  missionId: string;
  missionName: string;
  stepIndex: number;
  totalSteps: number;
}

export interface MissionStepEvent extends BaseEvent {
  type: 'mission.step';
  missionId: string;
  missionName: string;
  stepName?: string;
  stepIndex: number;
  totalSteps: number;
}

export interface MissionCompletedEvent extends BaseEvent {
  type: 'mission.completed';
  missionId: string;
  missionName: string;
  stepIndex: number;
  totalSteps: number;
}

export interface MissionFailedEvent extends BaseEvent {
  type: 'mission.failed';
  missionId: string;
  missionName: string;
  stepIndex?: number;
  error: string;
}

export interface SimulationControlEvent extends BaseEvent {
  type:
    | 'simulation.started'
    | 'simulation.paused'
    | 'simulation.resumed'
    | 'simulation.play'
    | 'simulation.pause'
    | 'simulation.speed'
    | 'simulation.reset';
  speed?: number;
}

// Backward-compatible generic AgentEvent
export interface AgentEvent extends BaseEvent {
  agentId: string;
  previousStatus?: AgentStatus;
  currentStatus?: AgentStatus;
  taskId?: string;
  targetAgentId?: string;
  position?: Position;
  metadata?: Record<string, unknown>;
}

// Backward-compatible generic TaskEvent
export interface TaskEvent extends BaseEvent {
  taskId: string;
  agentId?: string;
  status: TaskStatus;
  progress?: number;
}

// --- Orchestration Events ---

export interface OrchestrationInitiativeStartedEvent extends BaseEvent {
  type: 'orchestration.initiative_started';
  initiativeId: string;
  title: string;
  totalNodes: number;
}

export interface OrchestrationDagGeneratedEvent extends BaseEvent {
  type: 'orchestration.dag_generated';
  initiativeId: string;
  nodes: TaskNode[];
  rootTaskIds: string[];
}

export interface OrchestrationTaskReadyEvent extends BaseEvent {
  type: 'orchestration.task_ready';
  initiativeId: string;
  nodeId: string;
  taskId: string;
  assignedAgentId?: string;
}

export interface OrchestrationTaskBlockedEvent extends BaseEvent {
  type: 'orchestration.task_blocked';
  initiativeId: string;
  nodeId: string;
  taskId: string;
  blockedBy: string[];
}

export interface OrchestrationParallelBatchStartedEvent extends BaseEvent {
  type: 'orchestration.parallel_batch_started';
  initiativeId: string;
  batchSize: number;
  nodeIds: string[];
  agentIds: string[];
}

export interface OrchestrationInitiativeCompletedEvent extends BaseEvent {
  type: 'orchestration.initiative_completed';
  initiativeId: string;
  title: string;
  totalTasks: number;
  completedTasks: number;
  durationMs: number;
  summary: string;
}

export interface OrchestrationInitiativeFailedEvent extends BaseEvent {
  type: 'orchestration.initiative_failed';
  initiativeId: string;
  title: string;
  error: string;
  failedNodeId?: string;
}

// --- Provider Events ---

export interface ProviderRegisteredEvent extends BaseEvent {
  type: 'provider.registered';
  providerId: string;
  providerName: string;
}

export interface ProviderHealthChangedEvent extends BaseEvent {
  type: 'provider.health_changed';
  providerId: string;
  health: ProviderHealth;
}

// Backward-compatible generic MessageEvent
export interface MessageEvent extends BaseEvent {
  messageData: MessageModel;
  sourceAgentId?: string;
  targetAgentId?: string;
  content?: string;
}

// Backward-compatible generic MissionEvent
export interface MissionEvent extends BaseEvent {
  missionId: string;
  missionName: string;
  stepName?: string;
  stepIndex?: number;
  totalSteps?: number;
  error?: string;
}

export type SimulationEvent =
  | AgentCreatedEvent
  | AgentStartedEvent
  | AgentStateChangedEvent
  | AgentMovedEvent
  | AgentTaskAssignedEvent
  | AgentTaskStartedEvent
  | AgentTaskProgressEvent
  | AgentTaskCompletedEvent
  | AgentTaskFailedEvent
  | AgentMessageSentEvent
  | AgentMessageReceivedEvent
  | AgentErrorEvent
  | AgentIdleEvent
  | RuntimeStartedEvent
  | RuntimeThinkingEvent
  | RuntimeToolStartedEvent
  | RuntimeToolCompletedEvent
  | RuntimeProgressEvent
  | RuntimeCompletedEvent
  | RuntimeFailedEvent
  | TaskLifecycleStartedEvent
  | TaskLifecycleProgressEvent
  | TaskLifecycleCompletedEvent
  | TaskLifecycleFailedEvent
  | OrchestrationInitiativeStartedEvent
  | OrchestrationDagGeneratedEvent
  | OrchestrationTaskReadyEvent
  | OrchestrationTaskBlockedEvent
  | OrchestrationParallelBatchStartedEvent
  | OrchestrationInitiativeCompletedEvent
  | OrchestrationInitiativeFailedEvent
  | ProviderRegisteredEvent
  | ProviderHealthChangedEvent
  | MissionStartedEvent
  | MissionStepEvent
  | MissionCompletedEvent
  | MissionFailedEvent
  | SimulationControlEvent
  | AgentEvent
  | TaskEvent
  | MissionEvent
  | StrategistEvent
  | CrmEvent
  | OutreachEvent
  | BaseEvent;

// --- Strategist, CRM & Outreach Specialized Events ---

export interface StrategistEvent extends BaseEvent {
  type: 'strategist.started' | 'strategist.completed' | 'strategist.failed';
  agentId: string;
  taskId?: string;
  company?: string;
  recommendation?: unknown;
  error?: string;
}

export interface CrmEvent extends BaseEvent {
  type: 'crm.prospect_created' | 'crm.status_changed' | 'crm.interaction_recorded';
  agentId: string;
  prospectId: string;
  company: string;
  previousStatus?: string;
  currentStatus?: string;
  interaction?: unknown;
}

export interface OutreachEvent extends BaseEvent {
  type:
    | 'outreach.draft_created'
    | 'outreach.reviewed'
    | 'outreach.awaiting_approval'
    | 'outreach.approved'
    | 'outreach.rejected';
  agentId: string;
  draftId: string;
  recipient: string;
  channel?: string;
  draft?: unknown;
  reason?: string;
}

// --- Farhan Professional Profile & Opportunity HQ Events ---

export interface ProfileEvent extends BaseEvent {
  type: 'profile.updated' | 'profile.approval.requested';
  agentId?: string;
  section?: string;
  suggestionId?: string;
  details?: unknown;
}

export interface OpportunityEvent extends BaseEvent {
  type: 'opportunity.discovered' | 'opportunity.verified' | 'opportunity.matched';
  opportunityId: string;
  title: string;
  organization: string;
  agentId?: string;
  fitAnalysis?: unknown;
}

export interface ApplicationEvent extends BaseEvent {
  type:
    | 'application.drafted'
    | 'application.approval.requested'
    | 'application.approved'
    | 'application.rejected'
    | 'application.submitted';
  applicationId: string;
  opportunityId: string;
  targetOrganization: string;
  agentId?: string;
  decidedBy?: string;
  rejectionReason?: string;
}

