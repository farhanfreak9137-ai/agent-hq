import Database from 'better-sqlite3';
import { OutreachDraft } from '../../src/types/index.ts';

export class OutreachDraftRepository {
  constructor(private db: Database.Database) {}

  public create(draft: OutreachDraft): OutreachDraft {
    const stmt = this.db.prepare(`
      INSERT INTO outreach_drafts (
        id, prospect_id, company, recipient, channel, subject, body,
        personalization_points, source_evidence, confidence, requires_human_approval,
        status, created_at, reviewed_at, reviewed_by, review_notes,
        approved_at, approved_by, rejection_reason, sent_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draft.id,
      draft.prospectId || null,
      draft.company || null,
      draft.recipient,
      draft.channel || 'email',
      draft.subject,
      draft.body,
      JSON.stringify(draft.personalization_points || []),
      JSON.stringify(draft.source_evidence || []),
      draft.confidence ?? 0.85,
      draft.requires_human_approval ? 1 : 1, // Enforced truthy
      draft.status || 'DRAFTED',
      draft.createdAt || Date.now(),
      draft.reviewedAt || null,
      draft.reviewedBy || null,
      draft.reviewNotes || null,
      draft.approvedAt || null,
      draft.approvedBy || null,
      draft.rejectionReason || null,
      draft.sentAt || null
    );

    return draft;
  }

  public findById(id: string): OutreachDraft | null {
    const stmt = this.db.prepare(`SELECT * FROM outreach_drafts WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByProspectId(prospectId: string): OutreachDraft[] {
    const stmt = this.db.prepare(
      `SELECT * FROM outreach_drafts WHERE prospect_id = ? ORDER BY created_at DESC`
    );
    const rows = stmt.all(prospectId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public findAll(filter?: { status?: string; limit?: number }): OutreachDraft[] {
    const limit = filter?.limit || 100;
    if (filter?.status) {
      const stmt = this.db.prepare(
        `SELECT * FROM outreach_drafts WHERE status = ? ORDER BY created_at DESC LIMIT ?`
      );
      const rows = stmt.all(filter.status, limit) as any[];
      return rows.map((r) => this.mapRow(r));
    }
    const stmt = this.db.prepare(
      `SELECT * FROM outreach_drafts ORDER BY created_at DESC LIMIT ?`
    );
    const rows = stmt.all(limit) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: Partial<OutreachDraft>): OutreachDraft | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: OutreachDraft = {
      ...existing,
      ...updates,
    };

    const stmt = this.db.prepare(`
      UPDATE outreach_drafts SET
        prospect_id = ?,
        company = ?,
        recipient = ?,
        channel = ?,
        subject = ?,
        body = ?,
        personalization_points = ?,
        source_evidence = ?,
        confidence = ?,
        requires_human_approval = ?,
        status = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        review_notes = ?,
        approved_at = ?,
        approved_by = ?,
        rejection_reason = ?,
        sent_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.prospectId || null,
      merged.company || null,
      merged.recipient,
      merged.channel,
      merged.subject,
      merged.body,
      JSON.stringify(merged.personalization_points || []),
      JSON.stringify(merged.source_evidence || []),
      merged.confidence,
      merged.requires_human_approval ? 1 : 1,
      merged.status,
      merged.reviewedAt || null,
      merged.reviewedBy || null,
      merged.reviewNotes || null,
      merged.approvedAt || null,
      merged.approvedBy || null,
      merged.rejectionReason || null,
      merged.sentAt || null,
      id
    );

    return merged;
  }

  public approve(id: string, approvedBy: string = 'human_operator'): OutreachDraft | null {
    return this.update(id, {
      status: 'APPROVED',
      approvedAt: Date.now(),
      approvedBy,
      rejectionReason: undefined,
    });
  }

  public reject(id: string, reason: string, rejectedBy: string = 'human_operator'): OutreachDraft | null {
    return this.update(id, {
      status: 'REJECTED',
      rejectionReason: reason,
      reviewedBy: rejectedBy,
    });
  }

  public markSent(id: string): { success: boolean; error?: string; draft?: OutreachDraft } {
    const draft = this.findById(id);
    if (!draft) {
      return { success: false, error: `Draft ${id} not found.` };
    }

    // STRICT HUMAN APPROVAL ENFORCEMENT
    if (draft.status !== 'APPROVED') {
      return {
        success: false,
        error: `SECURITY VIOLATION: Cannot send outreach draft ${id} because it is in status "${draft.status}". Only drafts with explicit "APPROVED" status can be sent.`,
      };
    }

    const updated = this.update(id, {
      status: 'SENT',
      sentAt: Date.now(),
    });

    return { success: true, draft: updated || undefined };
  }

  private mapRow(row: any): OutreachDraft {
    return {
      id: row.id,
      prospectId: row.prospect_id || undefined,
      company: row.company || undefined,
      recipient: row.recipient,
      channel: row.channel as any,
      subject: row.subject,
      body: row.body,
      personalization_points: row.personalization_points ? JSON.parse(row.personalization_points) : [],
      source_evidence: row.source_evidence ? JSON.parse(row.source_evidence) : [],
      confidence: Number(row.confidence),
      requires_human_approval: true,
      status: row.status as any,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at || undefined,
      reviewedBy: row.reviewed_by || undefined,
      reviewNotes: row.review_notes || undefined,
      approvedAt: row.approved_at || undefined,
      approvedBy: row.approved_by || undefined,
      rejectionReason: row.rejection_reason || undefined,
      sentAt: row.sent_at || undefined,
    };
  }
}
