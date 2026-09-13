import { AgentHandoff, Artifact } from '../types/index.ts';
import { MessageBus } from './MessageBus.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

export interface CreateHandoffOptions {
  sourceAgentId: string;
  targetAgentId: string;
  taskId: string;
  reason: string;
  summary: string;
  artifacts?: Artifact[];
  confidence?: number;
  recommendedNextAction?: string;
}

/**
 * HandoffProtocol standardizes inter-agent work transfers.
 * Automatically dispatches structured messages, triggers the physical Canvas flying envelope,
 * and records handoff metadata across EventBus and agent memories.
 */
export class HandoffProtocol {
  public static createHandoff(options: CreateHandoffOptions): AgentHandoff {
    const confidence = options.confidence !== undefined
      ? Math.max(0.0, Math.min(1.0, options.confidence))
      : 0.95;

    return {
      sourceAgentId: options.sourceAgentId,
      targetAgentId: options.targetAgentId,
      taskId: options.taskId,
      reason: options.reason,
      summary: options.summary,
      artifacts: options.artifacts || [],
      confidence,
      recommendedNextAction: options.recommendedNextAction,
    };
  }

  /**
   * Transmits a handoff between two agents:
   * 1. Sends typed message through MessageBus (which generates the physical Canvas FlyingEnvelope).
   * 2. Emits an 'agent.handoff' lifecycle event on EventBus.
   */
  public static transmitHandoff(handoff: AgentHandoff): void {
    const artifactCount = handoff.artifacts.length;
    const artifactNote = artifactCount > 0 ? ` (${artifactCount} artifact${artifactCount > 1 ? 's' : ''} attached)` : '';
    const confidencePct = Math.round(handoff.confidence * 100);

    const messageText = `Handoff [${confidencePct}% conf]: ${handoff.reason}. ${handoff.summary}${artifactNote}`;

    // Dispatches through MessageBus -> triggers FlyingEnvelope on Canvas!
    MessageBus.sendMessage(
      handoff.sourceAgentId,
      handoff.targetAgentId,
      messageText,
      'handoff',
      handoff.taskId,
      handoff
    );

    EventBus.emit({
      id: generateId('ev_handoff'),
      type: 'agent.handoff',
      timestamp: Date.now(),
      sourceAgentId: handoff.sourceAgentId,
      targetAgentId: handoff.targetAgentId,
      taskId: handoff.taskId,
      confidence: handoff.confidence,
      handoff,
      message: `${handoff.sourceAgentId.toUpperCase()} handed off task to ${handoff.targetAgentId.toUpperCase()} [${confidencePct}% confidence]: "${handoff.summary.substring(0, 48)}..."`,
    } as any);
  }
}
