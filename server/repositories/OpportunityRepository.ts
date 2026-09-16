import Database from 'better-sqlite3';
import {
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  VALID_OPPORTUNITY_TRANSITIONS,
} from '../../src/types/index.ts';

export class OpportunityRepository {
  constructor(private db: Database.Database) {}

  public create(opp: Opportunity): { success: boolean; error?: string; opportunity?: Opportunity; isDuplicate?: boolean } {
    const duplicate = this.checkDuplicate(opp.organization, opp.title, opp.sourceUrl);
    if (duplicate) {
      return {
        success: false,
        error: `Opportunity "${opp.title}" at "${opp.organization}" already exists in Opportunity HQ.`,
        opportunity: duplicate,
        isDuplicate: true,
      };
    }

    const stmt = this.db.prepare(`
      INSERT INTO opportunities (
        id, title, organization, type, source, source_url, location, remote,
        description, requirements, eligibility, deadline, discovered_at,
        matched_skills, missing_skills, evidence, fit_analysis, status,
        application_draft_id, source_verification, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      opp.id,
      opp.title.trim(),
      opp.organization.trim(),
      opp.type || 'job',
      opp.source || 'Direct Discovery',
      opp.sourceUrl.trim(),
      opp.location || 'Remote',
      opp.remote ? 1 : 0,
      opp.description || '',
      JSON.stringify(opp.requirements || []),
      JSON.stringify(opp.eligibility || []),
      opp.deadline ? String(opp.deadline) : null,
      opp.discoveredAt || Date.now(),
      JSON.stringify(opp.matchedSkills || []),
      JSON.stringify(opp.missingSkills || []),
      JSON.stringify(opp.evidence || []),
      opp.fitAnalysis ? JSON.stringify(opp.fitAnalysis) : null,
      opp.status || 'DISCOVERED',
      opp.applicationDraftId || null,
      opp.sourceVerification || 'UNVERIFIED',
      opp.createdAt || Date.now(),
      opp.updatedAt || Date.now()
    );

    return { success: true, opportunity: opp };
  }

  public createOpportunity(opp: any): { success: boolean; error?: string; opportunity?: Opportunity; isDuplicate?: boolean } {
    const res = this.create(opp);
    if (!res.success && res.isDuplicate) {
      throw new Error(`Duplicate opportunity detected: ${res.error}`);
    }
    return res;
  }

  public checkDuplicate(organization: string, title: string, sourceUrl?: string): Opportunity | null {
    if (sourceUrl && sourceUrl.trim().length > 0) {
      const stmtUrl = this.db.prepare(
        'SELECT * FROM opportunities WHERE LOWER(source_url) = LOWER(?) LIMIT 1'
      );
      const rowUrl = stmtUrl.get(sourceUrl.trim()) as any;
      if (rowUrl) return this.mapRow(rowUrl);
    }

    const stmtOrg = this.db.prepare(
      'SELECT * FROM opportunities WHERE LOWER(organization) = LOWER(?) AND LOWER(title) = LOWER(?) LIMIT 1'
    );
    const row = stmtOrg.get(organization.trim(), title.trim()) as any;
    if (row) return this.mapRow(row);

    return null;
  }

  public findById(id: string): Opportunity | null {
    const stmt = this.db.prepare('SELECT * FROM opportunities WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findAll(filter?: {
    type?: OpportunityType;
    status?: OpportunityStatus;
    remote?: boolean;
    limit?: number;
  }): Opportunity[] {
    const limit = filter?.limit || 200;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.type) {
      conditions.push('type = ?');
      params.push(filter.type);
    }
    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.remote !== undefined) {
      conditions.push('remote = ?');
      params.push(filter.remote ? 1 : 0);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM opportunities ${whereClause} ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: Partial<Opportunity>): Opportunity | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: Opportunity = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE opportunities SET
        title = ?,
        organization = ?,
        type = ?,
        source = ?,
        source_url = ?,
        location = ?,
        remote = ?,
        description = ?,
        requirements = ?,
        eligibility = ?,
        deadline = ?,
        matched_skills = ?,
        missing_skills = ?,
        evidence = ?,
        fit_analysis = ?,
        status = ?,
        application_draft_id = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.title,
      merged.organization,
      merged.type,
      merged.source,
      merged.sourceUrl,
      merged.location,
      merged.remote ? 1 : 0,
      merged.description,
      JSON.stringify(merged.requirements || []),
      JSON.stringify(merged.eligibility || []),
      merged.deadline ? String(merged.deadline) : null,
      JSON.stringify(merged.matchedSkills || []),
      JSON.stringify(merged.missingSkills || []),
      JSON.stringify(merged.evidence || []),
      merged.fitAnalysis ? JSON.stringify(merged.fitAnalysis) : null,
      merged.status,
      merged.applicationDraftId || null,
      merged.updatedAt,
      id
    );

    return merged;
  }

  public transitionStatus(
    id: string,
    newStatus: OpportunityStatus,
    _actorAgentId: string = 'system',
    _note?: string
  ): { success: boolean; error?: string; opportunity?: Opportunity } {
    const opp = this.findById(id);
    if (!opp) {
      return { success: false, error: `Opportunity ${id} not found.` };
    }

    if (opp.status === newStatus) {
      return { success: true, opportunity: opp };
    }

    const allowed = VALID_OPPORTUNITY_TRANSITIONS[opp.status] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid state transition: Cannot move opportunity "${opp.title}" from ${opp.status} to ${newStatus}. Allowed next states: [${allowed.join(', ')}].`,
      };
    }

    const updated = this.update(id, { status: newStatus });
    return { success: true, opportunity: updated || undefined };
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM opportunities WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  private mapRow(row: any): Opportunity {
    return {
      id: row.id,
      title: row.title,
      organization: row.organization,
      type: row.type as OpportunityType,
      source: row.source,
      sourceUrl: row.source_url,
      location: row.location,
      remote: Boolean(row.remote),
      description: row.description,
      requirements: row.requirements ? JSON.parse(row.requirements) : [],
      eligibility: row.eligibility ? JSON.parse(row.eligibility) : [],
      deadline: row.deadline || undefined,
      discoveredAt: row.discovered_at,
      matchedSkills: row.matched_skills ? JSON.parse(row.matched_skills) : [],
      missingSkills: row.missing_skills ? JSON.parse(row.missing_skills) : [],
      evidence: row.evidence ? JSON.parse(row.evidence) : [],
      fitAnalysis: row.fit_analysis ? JSON.parse(row.fit_analysis) : undefined,
      status: row.status as OpportunityStatus,
      applicationDraftId: row.application_draft_id || undefined,
      sourceVerification: (row.source_verification || 'UNVERIFIED') as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
