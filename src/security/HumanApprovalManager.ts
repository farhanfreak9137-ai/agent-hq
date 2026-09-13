import { HumanApprovalRequest, HumanApprovalStatus } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { EventBus } from '../events/EventBus.ts';

export interface RequestApprovalOptions {
  taskId: string;
  agentId: string;
  toolId: string;
  toolName: string;
  parameters?: Record<string, unknown>;
  reason: string;
}

/**
 * HumanApprovalManager enforces the human-in-the-loop security boundary.
 * Any RESTRICTED tool execution or sensitive state transition must be queued
 * and explicitly authorized by a human operator before proceeding.
 */
export class HumanApprovalManager {
  private static instance: HumanApprovalManager | null = null;
  private pendingRequests: Map<string, HumanApprovalRequest> = new Map();
  private resolvers: Map<string, (approved: boolean) => void> = new Map();

  private constructor() {}

  public static getInstance(): HumanApprovalManager {
    if (!HumanApprovalManager.instance) {
      HumanApprovalManager.instance = new HumanApprovalManager();
    }
    return HumanApprovalManager.instance;
  }

  /**
   * Request human approval for a restricted tool or sensitive action.
   * Returns a promise that resolves only when human explicitly approves or rejects.
   */
  public async requestApproval(options: RequestApprovalOptions): Promise<{ approved: boolean; reason?: string }> {
    const request: HumanApprovalRequest = {
      id: generateId('appr'),
      taskId: options.taskId,
      agentId: options.agentId,
      toolId: options.toolId,
      toolName: options.toolName,
      parameters: options.parameters,
      reason: options.reason,
      status: 'PENDING',
      requestedAt: Date.now(),
    };

    this.pendingRequests.set(request.id, request);

    // Emit event for UI modal / notification banner
    EventBus.emit({
      id: generateId('ev_appr_req'),
      type: 'approval.requested',
      timestamp: request.requestedAt,
      request,
      message: `HUMAN APPROVAL REQUIRED: ${options.agentId.toUpperCase()} requests execution of RESTRICTED tool [${options.toolName}]: "${options.reason}"`,
    } as any);

    return new Promise<{ approved: boolean; reason?: string }>((resolve) => {
      this.resolvers.set(request.id, (approved: boolean) => {
        resolve({
          approved,
          reason: approved ? 'Explicitly authorized by human operator' : 'Rejected by human operator',
        });
      });
    });
  }

  /**
   * Human operator approves a pending request.
   */
  public approve(requestId: string, operatorUsername: string = 'human_admin'): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.status !== 'PENDING') return false;

    req.status = 'APPROVED';
    req.decidedAt = Date.now();
    req.decidedBy = operatorUsername;

    EventBus.emit({
      id: generateId('ev_appr_ok'),
      type: 'approval.granted',
      timestamp: req.decidedAt,
      request: req,
      message: `HUMAN APPROVAL GRANTED for [${req.toolName}] by ${operatorUsername}`,
    } as any);

    const resolver = this.resolvers.get(requestId);
    if (resolver) {
      resolver(true);
      this.resolvers.delete(requestId);
    }
    this.pendingRequests.delete(requestId);

    return true;
  }

  /**
   * Human operator rejects a pending request.
   */
  public reject(requestId: string, operatorUsername: string = 'human_admin', reason?: string): boolean {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.status !== 'PENDING') return false;

    req.status = 'REJECTED';
    req.decidedAt = Date.now();
    req.decidedBy = operatorUsername;

    EventBus.emit({
      id: generateId('ev_appr_rej'),
      type: 'approval.rejected',
      timestamp: req.decidedAt,
      request: req,
      message: `HUMAN APPROVAL REJECTED for [${req.toolName}] by ${operatorUsername}: ${reason || 'Denied'}`,
    } as any);

    const resolver = this.resolvers.get(requestId);
    if (resolver) {
      resolver(false);
      this.resolvers.delete(requestId);
    }
    this.pendingRequests.delete(requestId);

    return true;
  }

  public getPendingRequests(): HumanApprovalRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  public clear(): void {
    this.pendingRequests.clear();
    this.resolvers.clear();
  }
}
