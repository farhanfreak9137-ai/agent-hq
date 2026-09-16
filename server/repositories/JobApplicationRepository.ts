import Database from 'better-sqlite3';
import { JobApplication } from '../../src/types/index.ts';

export class JobApplicationRepository {
  constructor(private db: Database.Database) {}

  public create(app: JobApplication): JobApplication {
    const stmt = this.db.prepare(`
      INSERT INTO job_applications (
        id, opportunity_id, target_organization, opportunity_title,
        selected_profile_info, tailored_resume, application_message,
        missing_info, potential_risks, status, created_at, updated_at,
        approved_at, approved_by, rejection_reason, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      app.id,
      app.opportunityId,
      app.targetOrganization,
      app.opportunityTitle,
      JSON.stringify(app.selectedProfileInformation || {}),
      JSON.stringify(app.tailoredResume || {}),
      app.applicationMessage,
      JSON.stringify(app.missingInformation || []),
      JSON.stringify(app.potentialRisks || []),
      app.status || 'DRAFTED',
      app.createdAt || Date.now(),
      app.updatedAt || Date.now(),
      app.approvedAt || null,
      app.approvedBy || null,
      app.rejectionReason || null,
      app.submittedAt || null
    );

    return app;
  }

  public findById(id: string): JobApplication | null {
    const stmt = this.db.prepare('SELECT * FROM job_applications WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByOpportunityId(opportunityId: string): JobApplication | null {
    const stmt = this.db.prepare(
      'SELECT * FROM job_applications WHERE opportunity_id = ? ORDER BY created_at DESC LIMIT 1'
    );
    const row = stmt.get(opportunityId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findAll(status?: string): JobApplication[] {
    if (status) {
      const stmt = this.db.prepare(
        'SELECT * FROM job_applications WHERE status = ? ORDER BY updated_at DESC'
      );
      return (stmt.all(status) as any[]).map(this.mapRow);
    }
    const stmt = this.db.prepare('SELECT * FROM job_applications ORDER BY updated_at DESC');
    return (stmt.all() as any[]).map(this.mapRow);
  }

  public update(id: string, updates: Partial<JobApplication>): JobApplication | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: JobApplication = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE job_applications SET
        target_organization = ?,
        opportunity_title = ?,
        selected_profile_info = ?,
        tailored_resume = ?,
        application_message = ?,
        missing_info = ?,
        potential_risks = ?,
        status = ?,
        approved_at = ?,
        approved_by = ?,
        rejection_reason = ?,
        submitted_at = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      merged.targetOrganization,
      merged.opportunityTitle,
      JSON.stringify(merged.selectedProfileInformation || {}),
      JSON.stringify(merged.tailoredResume || {}),
      merged.applicationMessage,
      JSON.stringify(merged.missingInformation || []),
      JSON.stringify(merged.potentialRisks || []),
      merged.status,
      merged.approvedAt || null,
      merged.approvedBy || null,
      merged.rejectionReason || null,
      merged.submittedAt || null,
      merged.updatedAt,
      id
    );

    return merged;
  }

  public approve(id: string, approvedBy: string = 'Farhan'): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.findById(id);
    if (!app) {
      return { success: false, error: `Application ${id} not found.` };
    }

    const updated = this.update(id, {
      status: 'APPROVED',
      approvedAt: Date.now(),
      approvedBy,
      rejectionReason: undefined,
    });

    return { success: true, application: updated || undefined };
  }

  public reject(id: string, reason: string, rejectedBy: string = 'Farhan'): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.findById(id);
    if (!app) {
      return { success: false, error: `Application ${id} not found.` };
    }

    const updated = this.update(id, {
      status: 'REJECTED',
      rejectionReason: reason,
      approvedBy: rejectedBy,
    });

    return { success: true, application: updated || undefined };
  }

  public submit(id: string): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.findById(id);
    if (!app) {
      return { success: false, error: `Application ${id} not found.` };
    }

    // STRICT HUMAN APPROVAL SECURITY ENFORCEMENT
    if (app.status !== 'APPROVED') {
      return {
        success: false,
        error: `SECURITY ENFORCEMENT ERROR: Cannot submit application ${id}. It is currently in status "${app.status}". Explicit human approval ("APPROVED") is strictly required before submission.`,
      };
    }

    const updated = this.update(id, {
      status: 'SUBMITTED',
      submittedAt: Date.now(),
    });

    return { success: true, application: updated || undefined };
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM job_applications WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  private mapRow(row: any): JobApplication {
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      targetOrganization: row.target_organization,
      opportunityTitle: row.opportunity_title,
      selectedProfileInformation: row.selected_profile_info ? JSON.parse(row.selected_profile_info) : { selectedSkills: [], selectedProjects: [], educationSummary: '' },
      tailoredResume: row.tailored_resume ? JSON.parse(row.tailored_resume) : { headline: '', summary: '', highlightedSkills: [], tailoredProjects: [], education: '' },
      applicationMessage: row.application_message,
      missingInformation: row.missing_info ? JSON.parse(row.missing_info) : [],
      potentialRisks: row.potential_risks ? JSON.parse(row.potential_risks) : [],
      status: row.status as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      approvedAt: row.approved_at || undefined,
      approvedBy: row.approved_by || undefined,
      rejectionReason: row.rejection_reason || undefined,
      submittedAt: row.submitted_at || undefined,
    };
  }
}
