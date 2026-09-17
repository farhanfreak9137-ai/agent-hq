import Database from 'better-sqlite3';
import {
  ProfessionalProfile,
  ProfileSuggestion,
  ProfileVisibility,
} from '../../src/types/index.ts';
import { generateId } from '../../src/utils/id.ts';

export class ProfileRepository {
  constructor(private db: Database.Database) {}

  /**
   * Retrieves the authoritative profile document.
   * If scope is provided, filters data based on visibility:
   * - 'PUBLIC': Only fields/items with 'PUBLIC' visibility. Strips 'PRIVATE' and 'APPLICATION_ONLY'.
   * - 'APPLICATION': Includes 'PUBLIC' and 'APPLICATION_ONLY'. Strips 'PRIVATE'.
   * - 'FULL': Complete profile (internal/authorized user only).
   */
  public get(scope: 'PUBLIC' | 'APPLICATION' | 'FULL' = 'FULL'): ProfessionalProfile | null {
    const row = this.db.prepare('SELECT * FROM professional_profile LIMIT 1').get() as any;
    if (!row) return null;

    const profile: ProfessionalProfile = JSON.parse(row.data);
    if (scope === 'FULL') return profile;

    return this.filterByScope(profile, scope);
  }

  public getProfile(scope: 'PUBLIC' | 'APPLICATION' | 'FULL' = 'FULL'): ProfessionalProfile | null {
    return this.get(scope);
  }

  /**
   * Directly updates authoritative profile facts.
   * STRICT SECURITY & INTEGRITY GUARD:
   * Agents cannot directly mutate authoritative facts. Only explicit user actions are permitted.
   */
  public updateProfile(
    updates: Partial<ProfessionalProfile>,
    actor: { isUser?: boolean; isAuthoritativeUser?: boolean; actorId?: string; updatedBy?: string }
  ): { success: boolean; error?: string; profile?: ProfessionalProfile } {
    const isUser = actor.isUser ?? actor.isAuthoritativeUser ?? false;
    const actorId = actor.actorId ?? actor.updatedBy;
    if (!isUser) {
      throw new Error('Unauthorized: Agents cannot directly mutate authoritative profile data');
    }
    return this.updateAuthoritative(updates, { isUser: true, actorId });
  }

  public updateAuthoritative(
    updates: Partial<ProfessionalProfile>,
    actor: { isUser: boolean; actorId?: string }
  ): { success: boolean; error?: string; profile?: ProfessionalProfile } {
    if (!actor.isUser) {
      return {
        success: false,
        error:
          'AUTHORIZATION ERROR: Agents are strictly prohibited from silently mutating factual profile information. Submit an explicit suggestion via createSuggestion() for Farhan\'s review.',
      };
    }

    const current = this.get('FULL');
    if (!current) {
      return { success: false, error: 'Professional profile record not found.' };
    }

    const merged: ProfessionalProfile = {
      ...current,
      ...updates,
      identity: {
        ...current.identity,
        ...(updates.identity || {}),
        visibility: {
          ...current.identity.visibility,
          ...(updates.identity?.visibility || {}),
        },
      },
      skills: {
        ...current.skills,
        ...(updates.skills || {}),
        visibility: {
          ...current.skills.visibility,
          ...(updates.skills?.visibility || {}),
        },
      },
      services: {
        ...current.services,
        ...(updates.services || {}),
        visibility: {
          ...current.services.visibility,
          ...(updates.services?.visibility || {}),
        },
      },
      preferences: {
        ...current.preferences,
        ...(updates.preferences || {}),
      },
      documents: {
        ...current.documents,
        ...(updates.documents || {}),
      },
      version: current.version + 1,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE professional_profile
      SET data = ?, version = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(merged), merged.version, merged.updatedAt, current.id);

    return { success: true, profile: merged };
  }

  /**
   * Agents may suggest additions or improvements (e.g. missing skills or projects).
   * Holds the suggestion in PENDING state until Farhan authorizes or rejects it.
   */
  public createSuggestion(data: {
    agentId: string;
    reason: string;
    section: string;
    proposedChange: Record<string, unknown>;
  }): ProfileSuggestion {
    const id = generateId('sug');
    const now = Date.now();

    const suggestion: ProfileSuggestion = {
      id,
      agentId: data.agentId,
      reason: data.reason,
      section: data.section,
      proposedChange: data.proposedChange,
      status: 'PENDING',
      createdAt: now,
    };

    const stmt = this.db.prepare(`
      INSERT INTO profile_suggestions (
        id, agent_id, reason, section, proposed_change, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      suggestion.id,
      suggestion.agentId,
      suggestion.reason,
      suggestion.section,
      JSON.stringify(suggestion.proposedChange),
      suggestion.status,
      suggestion.createdAt
    );

    return suggestion;
  }

  public getSuggestions(status?: string): ProfileSuggestion[] {
    let stmt: any;
    if (status) {
      stmt = this.db.prepare(
        'SELECT * FROM profile_suggestions WHERE status = ? ORDER BY created_at DESC'
      );
      return (stmt.all(status) as any[]).map(this.mapSuggestionRow);
    }
    stmt = this.db.prepare(
      'SELECT * FROM profile_suggestions ORDER BY created_at DESC'
    );
    return (stmt.all() as any[]).map(this.mapSuggestionRow);
  }

  public approveSuggestion(
    suggestionId: string,
    approvedBy: string = 'Farhan'
  ): { success: boolean; error?: string; profile?: ProfessionalProfile } {
    const row = this.db
      .prepare('SELECT * FROM profile_suggestions WHERE id = ?')
      .get(suggestionId) as any;
    if (!row) {
      return { success: false, error: `Suggestion ${suggestionId} not found.` };
    }

    const suggestion = this.mapSuggestionRow(row);
    if (suggestion.status !== 'PENDING') {
      return {
        success: false,
        error: `Suggestion is already ${suggestion.status}.`,
      };
    }

    const currentProfile = this.get('FULL');
    if (!currentProfile) {
      return { success: false, error: 'Authoritative profile not found.' };
    }

    // Apply proposed change safely to section
    const proposed = suggestion.proposedChange;
    const updated = { ...currentProfile };

    if (suggestion.section === 'skills' && Array.isArray(proposed.newSkills)) {
      const category = (proposed.category as string) || 'tools';
      const existing = (updated.skills as any)[category] || [];
      const mergedList = Array.from(new Set([...existing, ...proposed.newSkills]));
      (updated.skills as any)[category] = mergedList;
      if (proposed.verified) {
        updated.skills.verifiedSkills = Array.from(
          new Set([...updated.skills.verifiedSkills, ...proposed.newSkills])
        );
      }
    } else if (suggestion.section === 'projects' && proposed.project) {
      const p = proposed.project as any;
      updated.projects = [...updated.projects, p];
    } else if (suggestion.section === 'certifications' && proposed.certification) {
      updated.certifications = [...updated.certifications, proposed.certification as any];
    }

    // Persist profile update as authorized by Farhan
    const updateRes = this.updateAuthoritative(updated, { isUser: true, actorId: approvedBy });
    if (!updateRes.success) {
      return updateRes;
    }

    // Mark suggestion approved
    this.db
      .prepare(
        'UPDATE profile_suggestions SET status = "APPROVED", decided_at = ?, decided_by = ? WHERE id = ?'
      )
      .run(Date.now(), approvedBy, suggestionId);

    return { success: true, profile: updateRes.profile };
  }

  public rejectSuggestion(
    suggestionId: string,
    rejectedBy: string = 'Farhan'
  ): { success: boolean; error?: string } {
    const stmt = this.db.prepare(
      'UPDATE profile_suggestions SET status = "REJECTED", decided_at = ?, decided_by = ? WHERE id = ?'
    );
    const info = stmt.run(Date.now(), rejectedBy, suggestionId);
    if (info.changes === 0) {
      return { success: false, error: `Suggestion ${suggestionId} not found.` };
    }
    return { success: true };
  }

  private filterByScope(
    profile: ProfessionalProfile,
    scope: 'PUBLIC' | 'APPLICATION'
  ): ProfessionalProfile {
    const isVisible = (vis: ProfileVisibility): boolean => {
      if (scope === 'PUBLIC') return vis === 'PUBLIC';
      if (scope === 'APPLICATION') return vis === 'PUBLIC' || vis === 'APPLICATION_ONLY';
      return false;
    };

    // Filter identity fields
    const filteredIdentity: any = {
      fullName: isVisible(profile.identity.visibility.fullName || 'PUBLIC')
        ? profile.identity.fullName
        : 'Confidential Candidate',
      professionalHeadline: profile.identity.professionalHeadline,
      portfolioUrl: isVisible(profile.identity.visibility.portfolioUrl || 'PUBLIC')
        ? profile.identity.portfolioUrl
        : '',
      githubUrl: isVisible(profile.identity.visibility.githubUrl || 'PUBLIC')
        ? profile.identity.githubUrl
        : '',
      location: isVisible(profile.identity.visibility.location || 'PUBLIC')
        ? profile.identity.location
        : '',
      email: isVisible(profile.identity.visibility.email || 'APPLICATION_ONLY')
        ? profile.identity.email
        : '[Email Protected]',
      bio: profile.identity.bio,
      visibility: profile.identity.visibility,
    };

    // Filter list arrays
    const filteredEducation = profile.education.filter((e) => isVisible(e.visibility));
    const filteredProjects = profile.projects.filter((p) => isVisible(p.visibility));
    const filteredExperience = profile.experience.filter((x) => isVisible(x.visibility));
    const filteredCertifications = profile.certifications.filter((c) => isVisible(c.visibility));
    const filteredAchievements = profile.achievements.filter((a) => isVisible(a.visibility));

    return {
      ...profile,
      identity: filteredIdentity,
      education: filteredEducation,
      projects: filteredProjects,
      experience: filteredExperience,
      certifications: filteredCertifications,
      achievements: filteredAchievements,
    };
  }

  private mapSuggestionRow(row: any): ProfileSuggestion {
    return {
      id: row.id,
      agentId: row.agent_id,
      reason: row.reason,
      section: row.section,
      proposedChange: JSON.parse(row.proposed_change),
      status: row.status,
      createdAt: row.created_at,
      decidedAt: row.decided_at || undefined,
      decidedBy: row.decided_by || undefined,
    };
  }
}
