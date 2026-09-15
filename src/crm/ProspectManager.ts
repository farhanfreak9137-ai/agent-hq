import {
  Prospect,
  ProspectStatus,
  ProspectInteraction,
  OutreachDraft,
  VALID_PROSPECT_TRANSITIONS,
} from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

const PROSPECTS_STORAGE_KEY = 'agent_hq_prospects';
const DRAFTS_STORAGE_KEY = 'agent_hq_outreach_drafts';

class ProspectManagerClass {
  private prospects: Map<string, Prospect> = new Map();
  private drafts: Map<string, OutreachDraft> = new Map();

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedProspects = window.localStorage.getItem(PROSPECTS_STORAGE_KEY);
        if (savedProspects) {
          const parsed = JSON.parse(savedProspects);
          if (Array.isArray(parsed)) {
            parsed.forEach((p: Prospect) => {
              if (p && p.id) this.prospects.set(p.id, p);
            });
          }
        }

        const savedDrafts = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
        if (savedDrafts) {
          const parsed = JSON.parse(savedDrafts);
          if (Array.isArray(parsed)) {
            parsed.forEach((d: OutreachDraft) => {
              if (d && d.id) this.drafts.set(d.id, d);
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private save(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          PROSPECTS_STORAGE_KEY,
          JSON.stringify(Array.from(this.prospects.values()))
        );
        window.localStorage.setItem(
          DRAFTS_STORAGE_KEY,
          JSON.stringify(Array.from(this.drafts.values()))
        );
      }
    } catch {
      // ignore
    }
  }

  public getAllProspects(): Prospect[] {
    return Array.from(this.prospects.values());
  }

  public getProspectById(id: string): Prospect | undefined {
    return this.prospects.get(id);
  }

  public findProspectByCompany(company: string): Prospect | undefined {
    const lower = company.trim().toLowerCase();
    for (const p of this.prospects.values()) {
      if (p.company.toLowerCase() === lower) return p;
    }
    return undefined;
  }

  public checkDuplicate(company: string, domain?: string): Prospect | undefined {
    const cLower = company.trim().toLowerCase();
    const dLower = domain ? domain.trim().toLowerCase() : undefined;

    for (const p of this.prospects.values()) {
      if (p.company.toLowerCase() === cLower) return p;
      if (dLower && p.domain && p.domain.toLowerCase() === dLower) return p;
    }
    return undefined;
  }

  public createProspect(
    data: Omit<Prospect, 'id' | 'status' | 'interactions' | 'createdAt' | 'updatedAt'> & {
      status?: ProspectStatus;
      id?: string;
    }
  ): { success: boolean; error?: string; prospect?: Prospect; isDuplicate?: boolean } {
    const duplicate = this.checkDuplicate(data.company, data.domain);
    if (duplicate) {
      return {
        success: false,
        error: `Prospect "${data.company}" already exists in CRM.`,
        prospect: duplicate,
        isDuplicate: true,
      };
    }

    const id = data.id || generateId('prospect');
    const now = Date.now();
    const status: ProspectStatus = data.status || 'DISCOVERED';

    const prospect: Prospect = {
      id,
      company: data.company.trim(),
      domain: data.domain?.trim(),
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      status,
      opportunity: data.opportunity,
      recommendedService: data.recommendedService,
      fit: data.fit || 'medium',
      priority: data.priority || 'medium',
      researchNotes: data.researchNotes || [],
      interactions: [
        {
          id: generateId('int'),
          timestamp: now,
          type: 'opportunity_identified',
          summary: `Prospect discovered and added to CRM.`,
          actorAgentId: 'crm',
          details: { opportunity: data.opportunity, service: data.recommendedService },
        },
      ],
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata,
    };

    this.prospects.set(id, prospect);
    this.save();

    EventBus.emit({
      id: generateId('ev_crm'),
      type: 'crm.prospect_created',
      timestamp: now,
      message: `New prospect registered: ${prospect.company} (Status: ${prospect.status})`,
      agentId: 'crm',
      prospectId: id,
      company: prospect.company,
    } as any);

    return { success: true, prospect };
  }

  public transitionStatus(
    id: string,
    newStatus: ProspectStatus,
    actorAgentId: string = 'crm',
    note?: string
  ): { success: boolean; error?: string; prospect?: Prospect } {
    const prospect = this.prospects.get(id);
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
        error: `Invalid transition: Cannot move prospect "${prospect.company}" from ${prospect.status} to ${newStatus}. Allowed next states: [${allowed.join(', ')}].`,
      };
    }

    const previousStatus = prospect.status;
    prospect.status = newStatus;
    prospect.updatedAt = Date.now();

    const interaction: ProspectInteraction = {
      id: generateId('int'),
      timestamp: prospect.updatedAt,
      type: 'status_change',
      summary: `Status changed from ${previousStatus} to ${newStatus}${note ? `: ${note}` : ''}`,
      actorAgentId,
      details: { previousStatus, newStatus, note },
    };
    prospect.interactions.push(interaction);

    this.save();

    EventBus.emit({
      id: generateId('ev_crm'),
      type: 'crm.status_changed',
      timestamp: Date.now(),
      message: `Prospect ${prospect.company} transitioned to ${newStatus}`,
      agentId: actorAgentId,
      prospectId: id,
      company: prospect.company,
      previousStatus,
      currentStatus: newStatus,
    } as any);

    return { success: true, prospect };
  }

  public recordInteraction(
    id: string,
    interactionData: Omit<ProspectInteraction, 'id' | 'timestamp'>
  ): Prospect | undefined {
    const prospect = this.prospects.get(id);
    if (!prospect) return undefined;

    const interaction: ProspectInteraction = {
      id: generateId('int'),
      timestamp: Date.now(),
      ...interactionData,
    };
    prospect.interactions.push(interaction);
    prospect.updatedAt = Date.now();
    this.save();

    EventBus.emit({
      id: generateId('ev_crm_int'),
      type: 'crm.interaction_recorded',
      timestamp: interaction.timestamp,
      message: `Interaction recorded for ${prospect.company}: ${interaction.summary}`,
      agentId: interactionData.actorAgentId || 'crm',
      prospectId: id,
      company: prospect.company,
      interaction,
    } as any);

    return prospect;
  }

  // --- Outreach Drafts ---

  public createDraft(draftData: Omit<OutreachDraft, 'id' | 'status' | 'createdAt' | 'requires_human_approval'> & {
    id?: string;
  }): OutreachDraft {
    const id = draftData.id || generateId('draft');
    const now = Date.now();

    const draft: OutreachDraft = {
      ...draftData,
      id,
      requires_human_approval: true,
      status: 'AWAITING_HUMAN_APPROVAL',
      createdAt: now,
    };

    this.drafts.set(id, draft);

    if (draft.prospectId) {
      const p = this.prospects.get(draft.prospectId);
      if (p) {
        p.draftId = id;
        this.transitionStatus(p.id, 'DRAFTED', 'outreach', 'Personalized outreach draft created.');
      }
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_outreach'),
      type: 'outreach.draft_created',
      timestamp: now,
      message: `Outreach draft created for ${draft.recipient}: "${draft.subject}"`,
      agentId: 'outreach',
      draftId: id,
      recipient: draft.recipient,
      draft,
    } as any);

    EventBus.emit({
      id: generateId('ev_outreach_wait'),
      type: 'outreach.awaiting_approval',
      timestamp: now,
      message: `Outreach draft awaiting human authorization for ${draft.recipient}`,
      agentId: 'outreach',
      draftId: id,
      recipient: draft.recipient,
    } as any);

    return draft;
  }

  public getDraftById(id: string): OutreachDraft | undefined {
    return this.drafts.get(id);
  }

  public getAllDrafts(): OutreachDraft[] {
    return Array.from(this.drafts.values());
  }

  public approveDraft(id: string, operator: string = 'human_operator'): OutreachDraft | null {
    const draft = this.drafts.get(id);
    if (!draft) return null;

    draft.status = 'APPROVED';
    draft.approvedAt = Date.now();
    draft.approvedBy = operator;
    draft.rejectionReason = undefined;

    if (draft.prospectId) {
      this.transitionStatus(draft.prospectId, 'APPROVED', 'human', `Outreach approved by ${operator}`);
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_outreach_appr'),
      type: 'outreach.approved',
      timestamp: Date.now(),
      message: `Outreach draft ${id} APPROVED by ${operator}`,
      agentId: 'human',
      draftId: id,
      recipient: draft.recipient,
    } as any);

    return draft;
  }

  public rejectDraft(id: string, reason: string, operator: string = 'human_operator'): OutreachDraft | null {
    const draft = this.drafts.get(id);
    if (!draft) return null;

    draft.status = 'REJECTED';
    draft.rejectionReason = reason;
    draft.reviewedBy = operator;

    this.save();

    EventBus.emit({
      id: generateId('ev_outreach_rej'),
      type: 'outreach.rejected',
      timestamp: Date.now(),
      message: `Outreach draft ${id} REJECTED: ${reason}`,
      agentId: 'human',
      draftId: id,
      recipient: draft.recipient,
      reason,
    } as any);

    return draft;
  }

  public markSent(id: string): { success: boolean; error?: string; draft?: OutreachDraft } {
    const draft = this.drafts.get(id);
    if (!draft) {
      return { success: false, error: `Draft ${id} not found.` };
    }

    // MANDATORY HUMAN APPROVAL ENFORCEMENT
    if (draft.status !== 'APPROVED') {
      return {
        success: false,
        error: `SECURITY ENFORCEMENT: Draft ${id} is in status "${draft.status}". Cannot send without explicit human approval!`,
      };
    }

    draft.status = 'SENT';
    draft.sentAt = Date.now();

    if (draft.prospectId) {
      this.transitionStatus(draft.prospectId, 'CONTACTED', 'outreach', `Email sent: "${draft.subject}"`);
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_outreach_sent'),
      type: 'agent.message_sent',
      timestamp: Date.now(),
      message: `OUTREACH SENT: "${draft.subject}" to ${draft.recipient}`,
      agentId: 'outreach',
      metadata: { draftId: id, recipient: draft.recipient },
    } as any);

    return { success: true, draft };
  }

  public clear(): void {
    this.prospects.clear();
    this.drafts.clear();
    this.save();
  }
}

export const ProspectManager = new ProspectManagerClass();
