export type AgentRole =
  | 'Orchestrator'
  | 'Coder'
  | 'Researcher'
  | 'Designer'
  | 'Reviewer'
  | 'Tester'
  | 'Security Engineer'
  | 'Writer'
  | 'Strategist'
  | 'CRM / Operations'
  | 'Outreach';

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
  | 'orchestration'
  | 'writing'
  | 'strategy'
  | 'crm'
  | 'outreach';

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
  | 'research_note'
  | 'opportunity_recommendation'
  | 'outreach_draft'
  | 'crm_summary';

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

// ==========================================
// STRATEGIST, CRM & OUTREACH SPECIALIZED MODELS
// ==========================================

export interface StrategistRecommendation {
  company: string;
  opportunity: string;
  evidence: string[];
  identified_problem: string;
  recommended_solution: string;
  recommended_service: string;
  scope: {
    complexity: 'low' | 'medium' | 'high';
    estimated_work: string;
  };
  fit: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high';
  confidence: number;
  uncertainties: string[];
  reasoning_summary: string;
}

export type ProspectStatus =
  | 'DISCOVERED'
  | 'RESEARCHED'
  | 'QUALIFIED'
  | 'DRAFTED'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'CONTACTED'
  | 'REPLIED'
  | 'INTERESTED'
  | 'MEETING'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export const VALID_PROSPECT_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  DISCOVERED: ['RESEARCHED', 'LOST'],
  RESEARCHED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['DRAFTED', 'LOST'],
  DRAFTED: ['AWAITING_APPROVAL', 'LOST'],
  AWAITING_APPROVAL: ['APPROVED', 'DRAFTED', 'LOST'],
  APPROVED: ['CONTACTED', 'LOST'],
  CONTACTED: ['REPLIED', 'LOST'],
  REPLIED: ['INTERESTED', 'LOST'],
  INTERESTED: ['MEETING', 'PROPOSAL', 'LOST'],
  MEETING: ['PROPOSAL', 'LOST'],
  PROPOSAL: ['WON', 'LOST'],
  WON: [],
  LOST: ['DISCOVERED'],
};

export interface ProspectInteraction {
  id: string;
  timestamp: number;
  type:
    | 'research'
    | 'opportunity_identified'
    | 'draft_created'
    | 'approval_requested'
    | 'approved'
    | 'rejected'
    | 'contacted'
    | 'reply_received'
    | 'status_change'
    | 'note';
  summary: string;
  actorAgentId: string;
  details?: Record<string, unknown>;
}

export interface Prospect {
  id: string;
  company: string;
  domain?: string;
  contactName?: string;
  contactEmail?: string;
  status: ProspectStatus;
  opportunity?: string;
  recommendedService?: string;
  fit?: 'low' | 'medium' | 'high';
  priority?: 'low' | 'medium' | 'high';
  researchNotes?: string[];
  interactions: ProspectInteraction[];
  draftId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface OutreachDraft {
  id: string;
  prospectId?: string;
  company?: string;
  recipient: string;
  channel: 'email' | 'linkedin' | 'custom';
  subject: string;
  body: string;
  personalization_points: string[];
  source_evidence: string[];
  confidence: number;
  requires_human_approval: true;
  status: 'DRAFTED' | 'REVIEWED' | 'AWAITING_HUMAN_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SENT';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNotes?: string;
  approvedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
  sentAt?: number;
}

// ==========================================
// FARHAN PROFESSIONAL PROFILE & OPPORTUNITY HQ
// ==========================================

export type ProfileVisibility = 'PUBLIC' | 'PRIVATE' | 'APPLICATION_ONLY';

export type ProfileSource =
  | 'USER_PROVIDED'
  | 'USER_CONFIRMED'
  | 'SYSTEM_IMPORTED'
  | 'AGENT_SUGGESTED';

export type SourceVerification =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'DEMO';

export type ResumeVariant = 'master' | 'frontend' | 'ai' | 'internship';

export interface ProfileCompleteness {
  score: number;
  sections: {
    identity: boolean;
    education: boolean;
    projects: boolean;
    skills: boolean;
    experience: boolean;
    certifications: 'none' | boolean;
    achievements: 'none' | boolean;
    documents: 'none' | boolean;
  };
  summary: string;
}

export interface ProfileIdentity {
  fullName: string;
  professionalName?: string;
  professionalHeadline: string;
  email: string;
  location: string;
  portfolioUrl: string;
  githubUrl: string;
  bio?: string;
  primaryInterests?: string[];
  visibility: Record<string, ProfileVisibility>;
  provenance?: ProfileSource;
}

export interface ProfileEducation {
  id: string;
  institution: string;
  level?: string;
  stream?: string;
  program: string;
  currentYear: string;
  expectedGraduation: string;
  previousInstitution?: string;
  college?: string;
  previousCollege?: string;
  hscStatus?: string;
  sscInstitution?: string;
  sscYear?: string;
  sscGpa?: string;
  sscInformation?: string;
  academicHistory?: string;
  visibility: ProfileVisibility;
  verified: boolean;
  provenance?: ProfileSource;
}

export interface ProfileSkills {
  frontend: string[];
  backend: string[];
  ai: string[];
  cloud: string[];
  databases: string[];
  tools: string[];
  languages: string[];
  development?: string[];
  verifiedSkills: string[];
  skillContext?: Record<string, 'PROJECT_EXPERIENCE' | 'LEARNING' | 'PROFESSIONAL_EXPERIENCE'>;
  visibility: Record<string, ProfileVisibility>;
  provenance?: ProfileSource;
}

export interface ProfileProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  role: string;
  status?: string;
  projectType?: 'personal' | 'student' | 'commercial' | 'open_source';
  capabilities?: string[];
  url?: string;
  githubUrl?: string;
  evidence: string[];
  visibility: ProfileVisibility;
  verified: boolean;
  provenance?: ProfileSource;
}

export interface ProfileExperience {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  reasonForLeaving?: string;
  verified: boolean;
  visibility: ProfileVisibility;
  provenance?: ProfileSource;
}

export interface ProfileCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  verified: boolean;
  visibility: ProfileVisibility;
  provenance?: ProfileSource;
}

export interface ProfileAchievement {
  id: string;
  title: string;
  description: string;
  date: string;
  verified: boolean;
  visibility: ProfileVisibility;
  provenance?: ProfileSource;
}

export interface ProfileServices {
  webDevelopment: boolean;
  frontendDevelopment: boolean;
  AIIntegration: boolean;
  automation: boolean;
  otherApprovedServices: string[];
  visibility: Record<string, ProfileVisibility>;
  provenance?: ProfileSource;
}

export interface ProfilePreferences {
  targetOpportunityTypes: OpportunityType[];
  targetIndustries: string[];
  targetLocations: string[];
  remotePreference: 'remote_only' | 'hybrid' | 'onsite' | 'flexible';
  visibility: ProfileVisibility;
}

export interface ProfileDocuments {
  resumeVersions: Array<{
    id: string;
    name: string;
    targetRole?: string;
    content: string;
    updatedAt: number;
  }>;
  coverLetterTemplates: Array<{
    id: string;
    name: string;
    template: string;
    updatedAt: number;
  }>;
}

export interface ProfessionalProfile {
  id: string;
  identity: ProfileIdentity;
  education: ProfileEducation[];
  skills: ProfileSkills;
  projects: ProfileProject[];
  experience: ProfileExperience[];
  certifications: ProfileCertification[];
  achievements: ProfileAchievement[];
  services: ProfileServices;
  preferences: ProfilePreferences;
  documents: ProfileDocuments;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface ProfileSuggestion {
  id: string;
  agentId: string;
  reason: string;
  section: string;
  proposedChange: Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: number;
  decidedAt?: number;
  decidedBy?: string;
}

export type OpportunityType =
  | 'internship'
  | 'job'
  | 'freelance'
  | 'hackathon'
  | 'competition'
  | 'open_source'
  | 'collaboration'
  | 'scholarship'
  | 'other';

export type OpportunityStatus =
  | 'DISCOVERED'
  | 'REVIEWING'
  | 'QUALIFIED'
  | 'APPLICATION_DRAFTED'
  | 'AWAITING_APPROVAL'
  | 'SUBMITTED'
  | 'RESPONSE_RECEIVED'
  | 'CLOSED'
  | 'REJECTED';

export const VALID_OPPORTUNITY_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  DISCOVERED: ['REVIEWING', 'REJECTED'],
  REVIEWING: ['QUALIFIED', 'REJECTED'],
  QUALIFIED: ['APPLICATION_DRAFTED', 'REJECTED'],
  APPLICATION_DRAFTED: ['AWAITING_APPROVAL', 'REJECTED'],
  AWAITING_APPROVAL: ['SUBMITTED', 'APPLICATION_DRAFTED', 'REJECTED'],
  SUBMITTED: ['RESPONSE_RECEIVED', 'CLOSED', 'REJECTED'],
  RESPONSE_RECEIVED: ['CLOSED', 'REJECTED'],
  CLOSED: ['DISCOVERED'],
  REJECTED: ['DISCOVERED'],
};

export interface OpportunityEligibilityCheck {
  criterion: string;
  status: 'MATCH' | 'GAP' | 'VERIFY';
  details?: string;
}

export interface OpportunityFitAnalysis {
  strongMatches: string[];
  potentialGaps: string[];
  eligibilityChecks: OpportunityEligibilityCheck[];
  evidence: string[];
  matchPercentage?: number;
  reasoning: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  type: OpportunityType;
  source: string;
  sourceUrl: string;
  location: string;
  remote: boolean;
  description: string;
  requirements: string[];
  eligibility: string[];
  deadline?: string | number;
  discoveredAt: number;
  matchedSkills: string[];
  missingSkills: string[];
  evidence: string[];
  fitAnalysis?: OpportunityFitAnalysis;
  status: OpportunityStatus;
  applicationDraftId?: string;
  sourceVerification: SourceVerification;
  createdAt: number;
  updatedAt: number;
}

export interface JobApplication {
  id: string;
  opportunityId: string;
  targetOrganization: string;
  opportunityTitle: string;
  selectedProfileInformation: {
    selectedSkills: string[];
    selectedProjects: Array<{
      name: string;
      role: string;
      technologies: string[];
      evidence: string[];
    }>;
    educationSummary: string;
  };
  tailoredResume: {
    headline: string;
    summary: string;
    highlightedSkills: string[];
    tailoredProjects: Array<{
      name: string;
      description: string;
      role: string;
      technologies: string[];
      evidence: string[];
    }>;
    education: string;
  };
  applicationMessage: string;
  coverLetter?: string;
  missingInformation: string[];
  potentialRisks: string[];
  status: 'DRAFTED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUBMITTED';
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  rejectionReason?: string;
  submittedAt?: number;
}


