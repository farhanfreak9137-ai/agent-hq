import { ReviewRequest, ReviewStatus, Artifact } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { EventBus } from '../events/EventBus.ts';
import { HandoffProtocol } from '../communication/HandoffProtocol.ts';
import { AgentManager } from '../agents/AgentManager.ts';

export interface InitiateReviewOptions {
  taskId: string;
  authorAgentId: string;
  reviewerAgentId: string;
  artifacts?: Artifact[];
  notes?: string;
  maxCycles?: number;
}

/**
 * ReviewWorkflow manages peer review loops with strict termination bounds.
 * Prevents infinite cycles by capping review iterations (default 2) and escalating
 * to BOSS if consensus is not reached.
 */
export class ReviewWorkflow {
  private static activeReviews: Map<string, ReviewRequest> = new Map();

  /**
   * Author agent submits deliverable to reviewer.
   */
  public static initiateReview(options: InitiateReviewOptions): ReviewRequest {
    const maxCycles = options.maxCycles ?? 2;
    const request: ReviewRequest = {
      id: generateId('rev'),
      taskId: options.taskId,
      authorAgentId: options.authorAgentId,
      reviewerAgentId: options.reviewerAgentId,
      artifacts: options.artifacts || [],
      notes: options.notes || 'Submitting implementation deliverables for peer review.',
      cycle: 1,
      maxCycles,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    ReviewWorkflow.activeReviews.set(request.id, request);

    // Physical handoff from author to reviewer
    HandoffProtocol.transmitHandoff(
      HandoffProtocol.createHandoff({
        sourceAgentId: request.authorAgentId,
        targetAgentId: request.reviewerAgentId,
        taskId: request.taskId,
        reason: 'Peer review requested',
        summary: `Review cycle ${request.cycle}/${request.maxCycles}: ${request.notes}`,
        artifacts: request.artifacts,
        confidence: 0.9,
        recommendedNextAction: 'Review code quality and security boundaries',
      })
    );

    EventBus.emit({
      id: generateId('ev_rev'),
      type: 'review.initiated',
      timestamp: Date.now(),
      review: request,
      message: `${request.authorAgentId.toUpperCase()} submitted review request (cycle 1/${maxCycles}) to ${request.reviewerAgentId.toUpperCase()}`,
    } as any);

    return request;
  }

  /**
   * Reviewer submits verdict: either approved or changes requested.
   */
  public static submitVerdict(
    reviewId: string,
    verdict: 'APPROVE' | 'REQUEST_CHANGES',
    feedback: string
  ): ReviewRequest {
    const review = ReviewWorkflow.activeReviews.get(reviewId);
    if (!review) {
      throw new Error(`Review request not found: ${reviewId}`);
    }

    if (verdict === 'APPROVE') {
      review.status = 'APPROVED';
      review.feedback = feedback;

      // Handoff approval back to author
      HandoffProtocol.transmitHandoff(
        HandoffProtocol.createHandoff({
          sourceAgentId: review.reviewerAgentId,
          targetAgentId: review.authorAgentId,
          taskId: review.taskId,
          reason: 'Review approved',
          summary: `Peer review APPROVED (cycle ${review.cycle}): ${feedback}`,
          artifacts: review.artifacts,
          confidence: 0.98,
          recommendedNextAction: 'Proceed to merge / testing stage',
        })
      );

      EventBus.emit({
        id: generateId('ev_rev_app'),
        type: 'review.approved',
        timestamp: Date.now(),
        review,
        message: `${review.reviewerAgentId.toUpperCase()} APPROVED review for ${review.authorAgentId.toUpperCase()}: "${feedback}"`,
      } as any);

      return review;
    }

    // Changes requested: evaluate cycle limit to prevent infinite loops
    if (review.cycle >= review.maxCycles) {
      review.status = 'EXCEEDED_MAX_CYCLES';
      review.feedback = `Max review cycles (${review.maxCycles}) reached without resolution. Escalating to BOSS. Last feedback: ${feedback}`;

      EventBus.emit({
        id: generateId('ev_rev_max'),
        type: 'review.cycle_limit_exceeded',
        timestamp: Date.now(),
        review,
        message: `TERMINATION GUARD: Review for task ${review.taskId} reached max cycles (${review.maxCycles}). Escalated to BOSS.`,
      } as any);

      // Escalate to BOSS
      AgentManager.setSpeech('boss', `Review cycle limit reached on task ${review.taskId.substring(0, 12)}. Synthesizing final decision.`, 4000);

      return review;
    }

    // Increment cycle and notify author of required revision
    review.cycle += 1;
    review.status = 'CHANGES_REQUESTED';
    review.feedback = feedback;

    HandoffProtocol.transmitHandoff(
      HandoffProtocol.createHandoff({
        sourceAgentId: review.reviewerAgentId,
        targetAgentId: review.authorAgentId,
        taskId: review.taskId,
        reason: 'Changes requested',
        summary: `Revision required (cycle ${review.cycle}/${review.maxCycles}): ${feedback}`,
        artifacts: review.artifacts,
        confidence: 0.75,
        recommendedNextAction: 'Implement requested fixes and resubmit',
      })
    );

    EventBus.emit({
      id: generateId('ev_rev_chg'),
      type: 'review.changes_requested',
      timestamp: Date.now(),
      review,
      message: `${review.reviewerAgentId.toUpperCase()} requested changes from ${review.authorAgentId.toUpperCase()} (now cycle ${review.cycle}/${review.maxCycles}): "${feedback}"`,
    } as any);

    return review;
  }

  public static getById(id: string): ReviewRequest | undefined {
    return ReviewWorkflow.activeReviews.get(id);
  }

  public static clear(): void {
    ReviewWorkflow.activeReviews.clear();
  }
}
