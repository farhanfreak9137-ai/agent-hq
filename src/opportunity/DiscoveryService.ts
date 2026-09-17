import {
  OpportunitySourceAdapter,
  RawOpportunity,
  NormalizedOpportunity,
} from './adapters/OpportunitySourceAdapter.ts';
import { OpportunityManager } from './OpportunityManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

export interface DiscoveryRunResult {
  runId: string;
  startTime: number;
  completionTime: number;
  discoveredCount: number;
  duplicateCount: number;
  failureCount: number;
  sourceStatus: Record<
    string,
    {
      sourceName: string;
      status: 'SUCCESS' | 'FAILED';
      count: number;
      error?: string;
    }
  >;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
}

/**
 * DiscoveryService coordinates:
 * External Source Adapters -> Normalization -> Deduplication -> Persistence (as UNVERIFIED)
 * -> Authoritative Eligibility / Profile Matching -> Opportunity HQ.
 *
 * STRICT SECURITY BOUNDARIES:
 * - Read-only external analyzer
 * - Does NOT modify authoritative professional profile
 * - Does NOT draft or submit applications
 * - Does NOT initiate outreach or contact employers/recruiters
 * - All discovered opportunities begin as UNVERIFIED
 * - Does NOT emit opportunity.verification.completed during discovery
 */
export class DiscoveryServiceClass {
  private adapters: Map<string, OpportunitySourceAdapter> = new Map();
  private isRunning: boolean = false;
  private currentRunId: string | null = null;
  private lastRunResult: DiscoveryRunResult | null = null;

  constructor() {
    // Note: Default production adapters are registered lazily or explicitly.
    // Mock adapters must NEVER be registered here.
  }

  /**
   * Registers an external opportunity adapter.
   */
  public registerAdapter(adapter: OpportunitySourceAdapter): void {
    this.adapters.set(adapter.sourceId, adapter);
  }

  /**
   * Unregisters an adapter (useful for testing or disabling sources).
   */
  public unregisterAdapter(sourceId: string): boolean {
    return this.adapters.delete(sourceId);
  }

  /**
   * Clears all registered adapters (primarily for test environments).
   */
  public clearAdapters(): void {
    this.adapters.clear();
  }

  /**
   * Returns list of currently registered adapters.
   */
  public getAdapters(): OpportunitySourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Returns current execution status.
   */
  public getStatus(): {
    isRunning: boolean;
    currentRunId: string | null;
    lastRunResult: DiscoveryRunResult | null;
  } {
    return {
      isRunning: this.isRunning,
      currentRunId: this.currentRunId,
      lastRunResult: this.lastRunResult,
    };
  }

  /**
   * Executes a manual discovery run across all registered source adapters.
   * Concurrency-protected: rejects overlapping execution.
   */
  public async runDiscovery(options?: {
    sourceIds?: string[];
  }): Promise<DiscoveryRunResult> {
    if (this.isRunning) {
      throw new Error(
        `CONCURRENCY_CONFLICT: A discovery run is already active (runId: ${this.currentRunId}). Please wait for it to complete.`
      );
    }

    const runId = generateId('disc_run');
    const startTime = Date.now();
    this.isRunning = true;
    this.currentRunId = runId;

    let discoveredCount = 0;
    let duplicateCount = 0;
    let failureCount = 0;
    const sourceStatus: DiscoveryRunResult['sourceStatus'] = {};

    try {
      const targetAdapters =
        options?.sourceIds && options.sourceIds.length > 0
          ? Array.from(this.adapters.values()).filter((a) =>
              options.sourceIds!.includes(a.sourceId)
            )
          : Array.from(this.adapters.values());

      for (const adapter of targetAdapters) {
        let rawItems: RawOpportunity[] = [];
        try {
          rawItems = await adapter.discover();
          sourceStatus[adapter.sourceId] = {
            sourceName: adapter.sourceName,
            status: 'SUCCESS',
            count: 0,
          };
        } catch (err: unknown) {
          failureCount++;
          const errorMsg = err instanceof Error ? err.message : String(err);
          sourceStatus[adapter.sourceId] = {
            sourceName: adapter.sourceName,
            status: 'FAILED',
            count: 0,
            error: errorMsg,
          };

          EventBus.emit({
            id: generateId('ev_opp_disc_fail'),
            type: 'opportunity.discovery.failed',
            timestamp: Date.now(),
            runId,
            sourceId: adapter.sourceId,
            error: errorMsg,
            message: `Discovery failed for source "${adapter.sourceName}": ${errorMsg}`,
          });
          continue;
        }

        let adapterDiscoveredCount = 0;

        for (const raw of rawItems) {
          // 1. Normalization
          const normalized: NormalizedOpportunity = adapter.normalize(raw);

          EventBus.emit({
            id: generateId('ev_opp_norm'),
            type: 'opportunity.normalized',
            timestamp: Date.now(),
            runId,
            sourceId: adapter.sourceId,
            title: normalized.title,
            organization: normalized.organization,
            message: `Normalized opportunity "${normalized.title}" from ${adapter.sourceName}`,
          });

          // 2. Deduplication check
          const dup = OpportunityManager.checkDuplicate(
            normalized.organization,
            normalized.title,
            normalized.sourceUrl
          );

          if (dup) {
            duplicateCount++;
            EventBus.emit({
              id: generateId('ev_opp_dup'),
              type: 'opportunity.duplicate_detected',
              timestamp: Date.now(),
              runId,
              sourceId: adapter.sourceId,
              opportunityId: dup.id,
              title: normalized.title,
              organization: normalized.organization,
              message: `Duplicate detected: "${normalized.title}" at "${normalized.organization}" matches existing opportunity ${dup.id}.`,
            });
            continue;
          }

          // 3. Persistence as UNVERIFIED
          // STRICT RULE: All discovered opportunities are UNVERIFIED
          const createResult = OpportunityManager.createOpportunity({
            title: normalized.title,
            organization: normalized.organization,
            type: normalized.type,
            source: normalized.source,
            sourceUrl: normalized.sourceUrl,
            location: normalized.location,
            remote: normalized.remote,
            description: normalized.description,
            requirements: normalized.requirements,
            eligibility: normalized.eligibility,
            deadline: normalized.deadline ? String(normalized.deadline) : null,
            status: 'DISCOVERED',
            sourceVerification: 'UNVERIFIED',
          });

          if (createResult.success && createResult.opportunity) {
            const oppId = createResult.opportunity.id;
            discoveredCount++;
            adapterDiscoveredCount++;

            // 4. Authoritative Eligibility Analysis & Profile Matching
            // (Uses OpportunityManager.matchOpportunity which strictly uses USER_CONFIRMED profile facts)
            EventBus.emit({
              id: generateId('ev_opp_elig'),
              type: 'opportunity.eligibility.checked',
              timestamp: Date.now(),
              runId,
              opportunityId: oppId,
              title: normalized.title,
              organization: normalized.organization,
              message: `Eligibility analysis evaluated for "${normalized.title}".`,
            });

            OpportunityManager.matchOpportunity(oppId);
          } else if (createResult.isDuplicate) {
            duplicateCount++;
          } else {
            failureCount++;
          }
        }

        if (sourceStatus[adapter.sourceId]) {
          sourceStatus[adapter.sourceId].count = adapterDiscoveredCount;
        }
      }

      const result: DiscoveryRunResult = {
        runId,
        startTime,
        completionTime: Date.now(),
        discoveredCount,
        duplicateCount,
        failureCount,
        sourceStatus,
        status: 'COMPLETED',
      };

      this.lastRunResult = result;

      EventBus.emit({
        id: generateId('ev_opp_disc_done'),
        type: 'opportunity.discovery.completed',
        timestamp: Date.now(),
        runId,
        discoveredCount,
        duplicateCount,
        failureCount,
        message: `Discovery run ${runId} completed: ${discoveredCount} new opportunities, ${duplicateCount} duplicates.`,
      });

      return result;
    } finally {
      this.isRunning = false;
      this.currentRunId = null;
    }
  }

  /**
   * Explicit Opportunity Verification method.
   * Emits opportunity.verification.completed ONLY when real verification is performed.
   */
  public verifyOpportunity(
    opportunityId: string,
    verified: boolean,
    verifier: string = 'Farhan',
    evidence: string[] = []
  ): { success: boolean; error?: string } {
    const opp = OpportunityManager.getOpportunityById(opportunityId);
    if (!opp) {
      return { success: false, error: `Opportunity ${opportunityId} not found.` };
    }

    if (verified) {
      opp.sourceVerification = 'VERIFIED';
      opp.updatedAt = Date.now();

      EventBus.emit({
        id: generateId('ev_opp_ver_comp'),
        type: 'opportunity.verification.completed',
        timestamp: Date.now(),
        opportunityId: opp.id,
        title: opp.title,
        organization: opp.organization,
        message: `Opportunity "${opp.title}" verified by ${verifier}. Evidence: ${evidence.join(', ') || 'Direct source review'}`,
      });
    } else {
      EventBus.emit({
        id: generateId('ev_opp_ver_fail'),
        type: 'opportunity.verification.failed',
        timestamp: Date.now(),
        opportunityId: opp.id,
        title: opp.title,
        organization: opp.organization,
        message: `Verification attempt failed or unconfirmed for "${opp.title}".`,
      });
    }

    return { success: true };
  }

  // =========================================================================
  // SCHEDULER INTEGRATION PLACEHOLDER (DISABLED BY DEFAULT)
  // =========================================================================
  // Automated background polling/cron is intentionally disabled in this phase.
  // When periodic discovery is approved for automated activation,
  // a cron/scheduler hook can invoke DiscoveryService.runDiscovery() here:
  //
  // private isSchedulerEnabled: boolean = false;
  // public enableScheduledDiscovery(intervalMs: number): void { ... }
  // public disableScheduledDiscovery(): void { ... }
}

export const DiscoveryService = new DiscoveryServiceClass();
