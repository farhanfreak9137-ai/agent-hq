export type AgentRole =
  | 'Orchestrator'
  | 'Coder'
  | 'Researcher'
  | 'Designer'
  | 'Reviewer'
  | 'Tester'
  | 'Security Engineer';

export type AgentStatus =
  | 'IDLE'
  | 'WALKING'
  | 'WORKING'
  | 'THINKING'
  | 'TOOL_EXECUTION'
  | 'COMMUNICATING'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'ERROR'
  | 'OFFLINE';

export type TaskStatus =
  | 'QUEUED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'TESTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'INTERRUPTED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Position {
  x: number;
  y: number;
}

export interface AvatarAppearance {
  hairStyle: 'short' | 'spiky' | 'bob' | 'curly' | 'visor';
  hairColor: string;
  skinColor: string;
  suitColor: string;
  accentColor: string;
  accessory?: 'glasses' | 'headset' | 'badge' | 'antenna' | 'visor';
}

export interface AgentStats {
  tasksCompleted: number;
  tasksInProgress: number;
  messagesSent: number;
  messagesReceived: number;
  linesOfCodeOrReviews: number;
  uptimeSeconds: number;
}

export type AgentCapability =
  | 'coding'
  | 'research'
  | 'design'
  | 'review'
  | 'testing'
  | 'security'
  | 'orchestration';

export type AgentRuntimeStatus =
  | 'IDLE'
  | 'STARTING'
  | 'WORKING'
  | 'THINKING'
  | 'TOOL_EXECUTION'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'COMMUNICATING'
  | 'COMPLETED'
  | 'ERROR'
  | 'TERMINATED';

export type ToolRiskPolicy = 'SAFE' | 'CONTROLLED' | 'RESTRICTED';

export interface ToolParameterSchema {
  type: string;
  description?: string;
  required?: boolean;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  capability: AgentCapability;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  policyRiskLevel?: ToolRiskPolicy;
  requiredCapability?: AgentCapability;
  parameters?: Record<string, unknown>;
  inputSchema?: Record<string, ToolParameterSchema>;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface ToolExecutionResult {
  toolId: string;
  toolName: string;
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'task_started' | 'task_completed' | 'tool_used' | 'message_received' | 'message_sent' | 'decision' | 'observation';
  content: string;
  agentId?: string;
  taskId?: string;
  sessionId?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}

export type ProviderCapability =
  | 'task_execution'
  | 'streaming'
  | 'tool_execution'
  | 'memory'
  | 'messaging'
  | 'subagents'
  | 'cancellation'
  | 'structured_output';

export interface ProviderHealth {
  status: 'available' | 'unavailable' | 'error';
  message?: string;
  latencyMs?: number;
  lastChecked: number;
}

export type TaskNodeStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskNode {
  id: string;
  taskId: string;
  title: string;
  description?: string;
  assignedAgentId?: string;
  dependencies: string[];
  dependents: string[];
  status: TaskNodeStatus;
  retryCount: number;
  maxRetries: number;
  priority?: TaskPriority;
  providerId?: string;
  executionMode?: 'real' | 'mock';
  result?: ToolExecutionResult | Record<string, unknown> | unknown;
  error?: string;
}

export interface TaskGraphModel {
  id: string;
  name: string;
  initiativeId: string;
  nodes: Map<string, TaskNode>;
  rootTaskIds: string[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
  error?: string;
}

export interface InitiativeDefinition {
  id: string;
  title: string;
  description: string;
  goal: string;
  phases?: {
    name: string;
    tasks: Array<{
      id: string;
      title: string;
      description: string;
      role: AgentRole;
      dependencies?: string[];
    }>;
  }[];
}

export interface InitiativeResult {
  initiativeId: string;
  title: string;
  success: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  durationMs: number;
  summary: string;
  error?: string;
}

export interface AgentModel {
  id: string;
  name: string;
  role: AgentRole;
  roleSymbol: string;
  description: string;
  personality: string;
  status: AgentStatus;
  providerId?: string;
  systemRole?: string;
  toolPermissions?: string[];
  runtimeConfig?: Record<string, unknown>;
  capabilities?: AgentCapability[];
  tools?: AgentTool[];
  currentTaskId: string | null;
  roomId: string;
  deskPosition: Position;
  currentPosition: Position;
  targetPosition: Position | null;
  facing: 'down' | 'up' | 'left' | 'right';
  avatar: AvatarAppearance;
  stats: AgentStats;
  createdAt: number;
  statusMessage?: string;
  thoughtBubble?: string;
  speechBubble?: {
    text: string;
    expiresAt: number;
  };
}

export interface RoomModel {
  id: string;
  name: string;
  type: 'command' | 'coding' | 'research' | 'design' | 'testing' | 'security' | 'common';
  x: number;
  y: number;
  width: number;
  height: number;
  colorTheme: string;
  doorway: Position;
  deskPositions: { agentId: string; pos: Position; facing: 'down' | 'up' | 'left' | 'right' }[];
  props: RoomProp[];
}

export interface RoomProp {
  id: string;
  type: 'desk' | 'dual_monitors' | 'server_rack' | 'bookshelf' | 'plant' | 'water_cooler' | 'couch' | 'coffee_table' | 'hologram_table' | 'whiteboard' | 'vending_machine';
  x: number;
  y: number;
  width: number;
  height: number;
  glowColor?: string;
  facing?: 'up' | 'down' | 'left' | 'right';
}

export interface TaskModel {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId: string | null;
  progress: number; // 0 to 100
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  dependencies: string[];
  logs: TaskLogEntry[];
  result?: any;
  error?: string;
  executionMode?: 'real' | 'mock';
}

export interface TaskLogEntry {
  id: string;
  timestamp: number;
  agentId: string;
  message: string;
  type: 'info' | 'code' | 'test' | 'review' | 'security' | 'success' | 'warn' | 'status' | 'tool';
}

export interface MessageModel {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  content: string;
  timestamp: number;
  type:
    | 'task_handover'
    | 'code_review'
    | 'test_report'
    | 'security_alert'
    | 'general'
    | 'status_update'
    | 'request'
    | 'response'
    | 'handoff'
    | 'result'
    | 'error';
  taskId?: string;
  handoffData?: unknown;
  read: boolean;
}

export interface FlyingEnvelope {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  fromPos: Position;
  toPos: Position;
  currentPos: Position;
  progress: number; // 0 to 1
  messageText: string;
  color: string;
}

// ==========================================
// PHASE 3B: ARTIFACTS, TELEMETRY & WORKFLOWS
// ==========================================

export type ArtifactType =
  | 'code'
  | 'document'
  | 'analysis'
  | 'test_report'
  | 'design'
  | 'security_report'
  | 'research_note';

export interface Artifact {
  id: string;
  taskId: string;
  agentId: string;
  missionId?: string;
  type: ArtifactType;
  title: string;
  content: string; // Markdown or JSON deliverable
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface AgentHandoff {
  sourceAgentId: string;
  targetAgentId: string;
  taskId: string;
  reason: string;
  summary: string;
  artifacts: Artifact[];
  confidence: number; // 0.0 to 1.0
  recommendedNextAction?: string;
}

export interface AgentContext {
  agentId: string;
  agentName: string;
  role: AgentRole;
  systemRole: string;
  capabilities: AgentCapability[];
  currentTask?: TaskModel;
  taskHistory: Array<{ taskId: string; title: string; success: boolean }>;
  relevantMemories: MemoryEntry[];
  availableTools: AgentTool[];
  recentMessages: MessageModel[];
  dependencyResults: Record<string, unknown>;
  providerCapabilities: ProviderCapability[];
  missionContext?: { missionId: string; title: string; phase?: string };
}

export interface CorrelationContext {
  missionId?: string;
  taskId?: string;
  executionId?: string;
  messageId?: string;
}

export interface AgentTelemetry {
  agentId: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalDurationMs: number;
  avgDurationMs: number;
  toolUsage: Record<string, number>;
  providerUsage: Record<string, number>;
  messagesSent: number;
  messagesReceived: number;
  reviewCycles: number;
  currentStatus: string;
}

export interface MissionTelemetry {
  missionId: string;
  totalTasks: number;
  completed: number;
  failed: number;
  blocked: number;
  running: number;
  avgDurationMs: number;
  parallelismFactor: number;
  providerUsage: Record<string, number>;
  estimatedCostTokens: number;
  startedAt: number;
  completedAt?: number;
}

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'EXCEEDED_MAX_CYCLES';

export interface ReviewRequest {
  id: string;
  taskId: string;
  authorAgentId: string;
  reviewerAgentId: string;
  artifacts: Artifact[];
  notes: string;
  cycle: number;
  maxCycles: number;
  status: ReviewStatus;
  feedback?: string;
  timestamp: number;
}

export type HumanApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface HumanApprovalRequest {
  id: string;
  taskId: string;
  agentId: string;
  toolId: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  reason: string;
  status: HumanApprovalStatus;
  requestedAt: number;
  decidedAt?: number;
  decidedBy?: string;
}

