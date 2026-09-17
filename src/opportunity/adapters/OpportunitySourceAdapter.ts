import { OpportunityType, OpportunityStatus, SourceVerification } from '../../types/index.ts';

/**
 * RawOpportunity represents unstructured or raw opportunity data
 * extracted directly from an external public source.
 */
export interface RawOpportunity {
  externalId: string;
  title: string;
  organization: string;
  rawType?: string;
  url: string;
  applyUrl?: string;
  location?: string;
  remote?: boolean;
  description?: string;
  requirements?: string[];
  eligibility?: string[];
  deadline?: string | number;
  discoveredAt?: number;
  tags?: string[];
  rawPayload?: Record<string, unknown>;
}

/**
 * NormalizedOpportunity represents an opportunity normalized into
 * the system's standard schema while strictly preserving provenance.
 *
 * All newly discovered opportunities begin as sourceVerification = 'UNVERIFIED'.
 */
export interface NormalizedOpportunity {
  id?: string;
  title: string;
  organization: string;
  type: OpportunityType;
  source: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  applicationUrl?: string;
  location: string;
  remote: boolean;
  description: string;
  requirements: string[];
  eligibility: string[];
  deadline?: string | number;
  discoveredAt: number;
  sourceVerification: SourceVerification;
  verificationTimestamp?: number;
  verificationEvidence?: string[];
  status: OpportunityStatus;
  evidence: string[];
}

/**
 * OpportunitySourceAdapter provides a common contract for external opportunity sources.
 * Adopters must preserve provenance and never fabricate unconfirmed fields.
 */
export interface OpportunitySourceAdapter {
  readonly sourceId: string;
  readonly sourceName: string;

  /**
   * Fetches raw opportunities from the external source.
   */
  discover(): Promise<RawOpportunity[]>;

  /**
   * Normalizes a raw opportunity into the standard schema.
   */
  normalize(raw: RawOpportunity): NormalizedOpportunity;
}
