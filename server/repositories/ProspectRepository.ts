import Database from 'better-sqlite3';
import {
  Prospect,
  ProspectInteraction,
  ProspectStatus,
  VALID_PROSPECT_TRANSITIONS,
} from '../../src/types/index.ts';
import { generateId } from '../../src/utils/id.ts';

export class ProspectRepository {
  constructor(private db: Database.Database) {}

  public create(prospect: Prospect): Prospect {
    const stmt = this.db.prepare(`
      INSERT INTO prospects (
        id, company, domain, contact_name, contact_email,
        status, opportunity, recommended_service, fit, priority,
        research_notes, interactions, draft_id, created_at, updated_at, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      prospect.id,
      prospect.company,
      prospect.domain || null,
      prospect.contactName || null,
      prospect.contactEmail || null,
      prospect.status || 'DISCOVERED',
      prospect.opportunity || null,
      prospect.recommendedService || null,
      prospect.fit || 'medium',
      prospect.priority || 'medium',
      prospect.researchNotes ? JSON.stringify(prospect.researchNotes) : null,
      prospect.interactions ? JSON.stringify(prospect.interactions) : JSON.stringify([]),
      prospect.draftId || null,
      prospect.createdAt || Date.now(),
      prospect.updatedAt || Date.now(),
      prospect.metadata ? JSON.stringify(prospect.metadata) : null
    );

    return prospect;
  }

  public findById(id: string): Prospect | null {
    const stmt = this.db.prepare(`SELECT * FROM prospects WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByCompany(company: string): Prospect | null {
    const stmt = this.db.prepare(`SELECT * FROM prospects WHERE LOWER(company) = LOWER(?) LIMIT 1`);
    const row = stmt.get(company.trim()) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public checkDuplicate(company: string, domain?: string): Prospect | null {
    if (domain) {
      const stmtDomain = this.db.prepare(
        `SELECT * FROM prospects WHERE LOWER(domain) = LOWER(?) OR LOWER(company) = LOWER(?) LIMIT 1`
      );
      const row = stmtDomain.get(domain.trim(), company.trim()) as any;
      if (row) return this.mapRow(row);
    }
    return this.findByCompany(company);
  }

  public findAll(filter?: { status?: ProspectStatus; limit?: number }): Prospect[] {
    const limit = filter?.limit || 100;
    if (filter?.status) {
      const stmt = this.db.prepare(
        `SELECT * FROM prospects WHERE status = ? ORDER BY updated_at DESC LIMIT ?`
      );
      const rows = stmt.all(filter.status, limit) as any[];
      return rows.map((r) => this.mapRow(r));
    }
    const stmt = this.db.prepare(`SELECT * FROM prospects ORDER BY updated_at DESC LIMIT ?`);
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: Partial<Prospect>): Prospect | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: Prospect = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE prospects SET
        company = ?,
        domain = ?,
        contact_name = ?,
        contact_email = ?,
        status = ?,
        opportunity = ?,
        recommended_service = ?,
        fit = ?,
        priority = ?,
        research_notes = ?,
        interactions = ?,
        draft_id = ?,
        updated_at = ?,
        metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.company,
      merged.domain || null,
      merged.contactName || null,
      merged.contactEmail || null,
      merged.status,
      merged.opportunity || null,
      merged.recommendedService || null,
      merged.fit || 'medium',
      merged.priority || 'medium',
      merged.researchNotes ? JSON.stringify(merged.researchNotes) : null,
      merged.interactions ? JSON.stringify(merged.interactions) : JSON.stringify([]),
      merged.draftId || null,
      merged.updatedAt,
      merged.metadata ? JSON.stringify(merged.metadata) : null,
      id
    );

    return merged;
  }

  public transitionStatus(
    id: string,
    newStatus: ProspectStatus,
    actorAgentId: string = 'crm',
    note?: string
  ): { success: boolean; error?: string; prospect?: Prospect } {
    const prospect = this.findById(id);
    if (!prospect) {
      return { success: false, error: `Prospect with ID ${id} not found.` };
    }

    if (prospect.status === newStatus) {
      return { success: true, prospect };
    }

    const allowed = VALID_PROSPECT_TRANSITIONS[prospect.status] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid state transition: Cannot move prospect "${prospect.company}" from ${prospect.status} to ${newStatus}. Allowed next states: [${allowed.join(', ')}].`,
      };
    }

    const interaction: ProspectInteraction = {
      id: generateId('int'),
      timestamp: Date.now(),
      type: 'status_change',
      summary: `Status transitioned from ${prospect.status} to ${newStatus}${note ? `: ${note}` : ''}`,
      actorAgentId,
      details: { previousStatus: prospect.status, newStatus, note },
    };

    const updatedInteractions = [...prospect.interactions, interaction];
    const updated = this.update(id, {
      status: newStatus,
      interactions: updatedInteractions,
    });

    return { success: true, prospect: updated || undefined };
  }

  public recordInteraction(
    id: string,
    interactionData: Omit<ProspectInteraction, 'id' | 'timestamp'>
  ): Prospect | null {
    const prospect = this.findById(id);
    if (!prospect) return null;

    const interaction: ProspectInteraction = {
      id: generateId('int'),
      timestamp: Date.now(),
      ...interactionData,
    };

    const updatedInteractions = [...prospect.interactions, interaction];
    return this.update(id, { interactions: updatedInteractions });
  }

  private mapRow(row: any): Prospect {
    return {
      id: row.id,
      company: row.company,
      domain: row.domain || undefined,
      contactName: row.contact_name || undefined,
      contactEmail: row.contact_email || undefined,
      status: row.status as ProspectStatus,
      opportunity: row.opportunity || undefined,
      recommendedService: row.recommended_service || undefined,
      fit: row.fit || undefined,
      priority: row.priority || undefined,
      researchNotes: row.research_notes ? JSON.parse(row.research_notes) : [],
      interactions: row.interactions ? JSON.parse(row.interactions) : [],
      draftId: row.draft_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}
