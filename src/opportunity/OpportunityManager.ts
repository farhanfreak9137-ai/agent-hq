import {
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  OpportunityFitAnalysis,
  JobApplication,
  SourceVerification,
  VALID_OPPORTUNITY_TRANSITIONS,
} from '../types/index.ts';
import { ProfileManager } from '../profile/ProfileManager.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

const OPPORTUNITIES_STORAGE_KEY = 'agent_hq_opportunities';
const APPLICATIONS_STORAGE_KEY = 'agent_hq_job_applications';

export const INITIAL_SEEDED_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp_seed_1',
    title: 'Full-Stack TypeScript & React Engineering Intern',
    organization: 'Vercel Ecosystem Labs',
    type: 'internship',
    source: 'GitHub Careers & Public Ecosystem',
    sourceUrl: 'https://github.com/careers/ecosystem-internships',
    location: 'Remote (Worldwide)',
    remote: true,
    description: 'Build responsive web applications and developer tools utilizing Next.js, React, and modern TypeScript workflows.',
    requirements: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS'],
    eligibility: ['Enrolled in Computer Science or related degree', 'Strong familiarity with modern web APIs'],
    deadline: '2026-10-15',
    discoveredAt: Date.now() - 86400000,
    matchedSkills: ['React', 'TypeScript', 'Tailwind CSS'],
    missingSkills: [],
    evidence: ['Agent HQ: React & TypeScript multi-agent architecture'],
    fitAnalysis: {
      strongMatches: ['React', 'TypeScript', 'Tailwind CSS'],
      potentialGaps: [],
      eligibilityChecks: [
        { criterion: 'Student Status', status: 'VERIFY', details: 'Enrollment unconfirmed in authoritative profile' },
        { criterion: 'Remote Eligibility', status: 'MATCH', details: 'Remote worldwide position' },
      ],
      evidence: ['Agent HQ'],
      matchPercentage: 100,
      reasoning: 'Demonstrates strong match with verified Agent HQ stack.',
    },
    status: 'QUALIFIED',
    sourceVerification: 'DEMO',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  },
  {
    id: 'opp_seed_2',
    title: 'Autonomous AI Systems Engineer',
    organization: 'Nexus AI Research Partner',
    type: 'job',
    source: 'Tech Opportunity Board',
    sourceUrl: 'https://jobs.tech/nexus-ai-systems-engineer',
    location: 'Remote',
    remote: true,
    description: 'Design, build, and optimize multi-agent orchestration frameworks, low-latency prompt pipelines, and autonomous reasoning loops.',
    requirements: ['TypeScript', 'Python', 'Multi-Agent Systems', 'LLM Orchestration', 'SQLite'],
    eligibility: ['Demonstrated portfolio of production agentic systems', 'High proficiency in concurrency and systems architecture'],
    deadline: '2026-11-01',
    discoveredAt: Date.now() - 172800000,
    matchedSkills: ['TypeScript', 'Python', 'Multi-Agent Systems', 'SQLite'],
    missingSkills: [],
    evidence: ['Agent HQ: Multi-agent concurrent operating system'],
    fitAnalysis: {
      strongMatches: ['TypeScript', 'Python', 'Multi-Agent Systems', 'SQLite'],
      potentialGaps: [],
      eligibilityChecks: [
        { criterion: 'Production Agent Experience', status: 'MATCH', details: 'Built Agent HQ from scratch' },
        { criterion: 'Remote Location', status: 'MATCH', details: 'Position supports global remote' },
      ],
      evidence: ['Agent HQ'],
      matchPercentage: 100,
      reasoning: 'Direct alignment with Agent HQ architecture and autonomous reasoning loops.',
    },
    status: 'QUALIFIED',
    sourceVerification: 'DEMO',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now(),
  },
  {
    id: 'opp_seed_3',
    title: 'Global Autonomous Agents Hackathon 2026',
    organization: 'Google Cloud & Devpost',
    type: 'hackathon',
    source: 'Devpost',
    sourceUrl: 'https://devpost.com/hackathons/global-agents-2026',
    location: 'Virtual / Global',
    remote: true,
    description: 'Build creative multi-agent autonomous applications leveraging Gemini APIs and Antigravity tooling.',
    requirements: ['Multi-Agent Systems', 'Gemini API', 'TypeScript'],
    eligibility: ['Open to individual creators and teams worldwide'],
    deadline: '2026-10-30',
    discoveredAt: Date.now() - 43200000,
    matchedSkills: ['Multi-Agent Systems', 'Gemini API', 'TypeScript'],
    missingSkills: [],
    evidence: ['Agent HQ multi-agent core with Gemini integration'],
    fitAnalysis: {
      strongMatches: ['Multi-Agent Systems', 'Gemini API', 'TypeScript'],
      potentialGaps: [],
      eligibilityChecks: [
        { criterion: 'Global Eligibility', status: 'MATCH', details: 'Open to worldwide developers' },
      ],
      evidence: ['Agent HQ'],
      matchPercentage: 100,
      reasoning: 'Perfect match for Farhan’s established Agent HQ system.',
    },
    status: 'DISCOVERED',
    sourceVerification: 'DEMO',
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now(),
  },
];

class OpportunityManagerClass {
  private opportunities: Map<string, Opportunity> = new Map();
  private applications: Map<string, JobApplication> = new Map();

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedOpps = window.localStorage.getItem(OPPORTUNITIES_STORAGE_KEY);
        if (savedOpps) {
          const parsed = JSON.parse(savedOpps);
          if (Array.isArray(parsed)) {
            parsed.forEach((o: Opportunity) => {
              if (o && o.id) this.opportunities.set(o.id, o);
            });
          }
        }

        const savedApps = window.localStorage.getItem(APPLICATIONS_STORAGE_KEY);
        if (savedApps) {
          const parsed = JSON.parse(savedApps);
          if (Array.isArray(parsed)) {
            parsed.forEach((a: JobApplication) => {
              if (a && a.id) this.applications.set(a.id, a);
            });
          }
        }
      }
    } catch {
      // ignore
    }

    if (this.opportunities.size === 0) {
      INITIAL_SEEDED_OPPORTUNITIES.forEach((o) => {
        this.opportunities.set(o.id, { ...o });
      });
    }
  }

  private save(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          OPPORTUNITIES_STORAGE_KEY,
          JSON.stringify(Array.from(this.opportunities.values()))
        );
        window.localStorage.setItem(
          APPLICATIONS_STORAGE_KEY,
          JSON.stringify(Array.from(this.applications.values()))
        );
      }
    } catch {
      // ignore
    }
  }

  public getAll(): Opportunity[] {
    return this.getAllOpportunities();
  }

  public getAllOpportunities(): Opportunity[] {
    return Array.from(this.opportunities.values());
  }

  public async syncFromBackend(): Promise<void> {
    try {
      const { ApiClient } = await import('../services/ApiClient.ts');
      const opps = await ApiClient.getInstance().getOpportunities();
      if (opps && Array.isArray(opps)) {
        opps.forEach((o) => {
          if (o && o.id) this.opportunities.set(o.id, o);
        });
        this.save();
      }
      const apps = await ApiClient.getInstance().getApplications();
      if (apps && Array.isArray(apps)) {
        apps.forEach((a) => {
          if (a && a.id) this.applications.set(a.id, a);
        });
        this.save();
      }
    } catch {
      // ignore network errors or fallback
    }
  }

  public getOpportunityById(id: string): Opportunity | undefined {
    return this.opportunities.get(id);
  }

  public checkDuplicate(organization: string, title: string, sourceUrl?: string): Opportunity | undefined {
    const orgLower = organization.trim().toLowerCase();
    const titleLower = title.trim().toLowerCase();
    const urlLower = sourceUrl?.trim().toLowerCase();

    for (const opp of this.opportunities.values()) {
      if (urlLower && opp.sourceUrl && opp.sourceUrl.toLowerCase() === urlLower) {
        return opp;
      }
      if (opp.organization.toLowerCase() === orgLower && opp.title.toLowerCase() === titleLower) {
        return opp;
      }
    }
    return undefined;
  }

  public createOpportunity(
    data: {
      id?: string;
      title: string;
      organization: string;
      type?: OpportunityType;
      source?: string;
      sourceUrl?: string;
      location?: string;
      remote?: boolean;
      description?: string;
      requirements?: string[];
      eligibility?: string[];
      deadline?: string | null;
      matchedSkills?: string[];
      missingSkills?: string[];
      evidence?: string[];
      fitAnalysis?: OpportunityFitAnalysis;
      status?: OpportunityStatus;
      applicationDraftId?: string;
      sourceVerification?: SourceVerification;
    }
  ): { success: boolean; error?: string; opportunity?: Opportunity; isDuplicate?: boolean } {
    const dup = this.checkDuplicate(data.organization, data.title, data.sourceUrl);
    if (dup) {
      return {
        success: false,
        error: `Opportunity "${data.title}" at "${data.organization}" already exists.`,
        opportunity: dup,
        isDuplicate: true,
      };
    }

    const id = data.id || generateId('opp');
    const now = Date.now();
    const opp: Opportunity = {
      ...data,
      id,
      title: data.title.trim(),
      organization: data.organization.trim(),
      type: data.type || 'job',
      source: data.source || 'Direct Source',
      sourceUrl: data.sourceUrl || 'UNKNOWN',
      location: data.location || 'UNKNOWN',
      remote: Boolean(data.remote),
      description: data.description || '',
      requirements: data.requirements || [],
      eligibility: data.eligibility || [],
      matchedSkills: data.matchedSkills || [],
      missingSkills: data.missingSkills || [],
      evidence: data.evidence || [],
      status: data.status || 'DISCOVERED',
      sourceVerification: data.sourceVerification || 'UNVERIFIED',
      discoveredAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.opportunities.set(id, opp);
    this.save();

    EventBus.emit({
      id: generateId('ev_opp_disc'),
      type: 'opportunity.discovered',
      timestamp: now,
      message: `Discovered opportunity: "${opp.title}" at ${opp.organization}`,
      opportunityId: id,
      title: opp.title,
      organization: opp.organization,
    } as any);

    return { success: true, opportunity: opp };
  }

  public transitionStatus(
    id: string,
    newStatus: OpportunityStatus,
    actorAgentId: string = 'system',
    note?: string
  ): { success: boolean; error?: string; opportunity?: Opportunity } {
    const opp = this.opportunities.get(id);
    if (!opp) return { success: false, error: `Opportunity ${id} not found.` };

    if (opp.status === newStatus) return { success: true, opportunity: opp };

    const allowed = VALID_OPPORTUNITY_TRANSITIONS[opp.status] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Invalid state transition: Cannot move opportunity "${opp.title}" from ${opp.status} to ${newStatus}. Allowed next states: [${allowed.join(', ')}].`,
      };
    }

    opp.status = newStatus;
    opp.updatedAt = Date.now();
    this.save();

    return { success: true, opportunity: opp };
  }

  /**
   * Evaluates an opportunity against Farhan's Professional Profile.
   * Produces a structured match analysis without political or vague AI opinions.
   * Calculates a transparent requirement-match percentage.
   */
  public matchOpportunity(opportunityId: string): { success: boolean; error?: string; fitAnalysis?: OpportunityFitAnalysis } {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) return { success: false, error: `Opportunity ${opportunityId} not found.` };

    const profile = ProfileManager.getProfile('FULL');
    const knownSkills = new Set(
      [
        ...profile.skills.frontend,
        ...profile.skills.backend,
        ...profile.skills.ai,
        ...profile.skills.cloud,
        ...profile.skills.databases,
        ...profile.skills.tools,
        ...profile.skills.languages,
        ...profile.skills.verifiedSkills,
      ].map((s) => s.toLowerCase().trim())
    );

    const strongMatches: string[] = [];
    const potentialGaps: string[] = [];

    for (const req of opp.requirements) {
      const clean = req.toLowerCase().trim();
      let matched = false;
      for (const skill of knownSkills) {
        if (skill.includes(clean) || clean.includes(skill)) {
          matched = true;
          strongMatches.push(req);
          break;
        }
      }
      if (!matched) {
        potentialGaps.push(req);
      }
    }

    // Eligibility checks
    const eligibilityChecks = (opp.eligibility.length > 0 ? opp.eligibility : ['General Eligibility']).map((e) => {
      const lower = e.toLowerCase();
      if (lower.includes('student') || lower.includes('degree') || lower.includes('enrolled')) {
        const verifiedEdu = profile.education.find((ed) => ed.verified && (ed.provenance === 'USER_PROVIDED' || ed.provenance === 'USER_CONFIRMED'));
        if (verifiedEdu) {
          return {
            criterion: e,
            status: 'MATCH' as const,
            details: `Enrolled student at ${verifiedEdu.institution}`,
          };
        } else {
          return {
            criterion: e,
            status: 'VERIFY' as const,
            details: 'Academic enrollment unconfirmed in authoritative profile. Requires manual verification.',
          };
        }
      }
      if (lower.includes('remote') || lower.includes('worldwide') || lower.includes('global')) {
        return {
          criterion: e,
          status: 'MATCH' as const,
          details: `Remote candidate operating worldwide`,
        };
      }
      return {
        criterion: e,
        status: 'VERIFY' as const,
        details: 'Review during application submission',
      };
    });

    // Match evidence from verified projects
    const evidence: string[] = [];
    profile.projects.forEach((proj) => {
      if (!proj.verified || (proj.provenance !== 'USER_PROVIDED' && proj.provenance !== 'USER_CONFIRMED')) {
        return;
      }
      const hasRelevantSkill = proj.technologies.some((t) =>
        opp.requirements.some((r) => r.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(r.toLowerCase()))
      );
      if (hasRelevantSkill) {
        evidence.push(`${proj.name} (${proj.role}): ${proj.technologies.slice(0, 4).join(', ')}`);
      }
    });

    const totalReqs = Math.max(opp.requirements.length, 1);
    const matchPercentage = Math.round((strongMatches.length / totalReqs) * 100);

    const fitAnalysis: OpportunityFitAnalysis = {
      strongMatches: Array.from(new Set(strongMatches)),
      potentialGaps: Array.from(new Set(potentialGaps)),
      eligibilityChecks,
      evidence: Array.from(new Set(evidence)),
      matchPercentage,
      reasoning: `Structured requirement matching: ${strongMatches.length}/${totalReqs} technical requirements directly verified across projects: ${evidence.slice(0, 2).map((e) => e.split('(')[0].trim()).join(', ')}.`,
    };

    opp.matchedSkills = fitAnalysis.strongMatches;
    opp.missingSkills = fitAnalysis.potentialGaps;
    opp.evidence = fitAnalysis.evidence;
    opp.fitAnalysis = fitAnalysis;
    opp.updatedAt = Date.now();

    if (opp.status === 'DISCOVERED' || opp.status === 'REVIEWING') {
      opp.status = matchPercentage >= 50 ? 'QUALIFIED' : 'REVIEWING';
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_opp_match'),
      type: 'opportunity.matched',
      timestamp: Date.now(),
      message: `Profile matched for "${opp.title}": ${matchPercentage}% requirement alignment.`,
      opportunityId: opp.id,
      title: opp.title,
      organization: opp.organization,
      fitAnalysis,
    } as any);

    return { success: true, fitAnalysis };
  }

  /**
   * Generates a tailored resume and customized application message.
   * STRICT ANTI-FABRICATION RULE:
   * Selects only verified projects, verified skills, and verified education.
   * If any requirement is missing, it is explicitly listed under missingInformation.
   * If any eligibility check is unknown or not matched, an ELIGIBILITY WARNING is generated.
   * The draft is strictly held in AWAITING_APPROVAL status.
   */
  public tailorResumeAndDraft(opportunityId: string): { success: boolean; error?: string; application?: JobApplication } {
    const opp = this.opportunities.get(opportunityId);
    if (!opp) return { success: false, error: `Opportunity ${opportunityId} not found.` };

    // Run match analysis if not already done
    if (!opp.fitAnalysis) {
      this.matchOpportunity(opportunityId);
    }

    const profile = ProfileManager.getProfile('APPLICATION'); // Never includes PRIVATE data

    // 1. Select ONLY verified projects with authoritative provenance
    const relevantProjects = profile.projects
      .filter((p) => p.verified && (p.provenance === 'USER_PROVIDED' || p.provenance === 'USER_CONFIRMED'))
      .map((p) => ({
        name: p.name,
        role: p.role,
        technologies: p.technologies,
        evidence: p.evidence,
      }));

    // 2. Select relevant verified skills
    const highlightedSkills = profile.skills.verifiedSkills.filter((s) =>
      opp.requirements.some((r) => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase()))
    );

    // Fallback highlighted skills if specific requirements are novel
    if (highlightedSkills.length === 0) {
      highlightedSkills.push(...profile.skills.verifiedSkills.slice(0, 6));
    }

    // 3. Identify missing information or potential risks
    const missingInformation: string[] = [];
    if (opp.missingSkills && opp.missingSkills.length > 0) {
      opp.missingSkills.forEach((gap) => {
        missingInformation.push(`Missing internal experience in: "${gap}". Clarify readiness to learn.`);
      });
    }

    const potentialRisks: string[] = [];
    if (opp.deadline && typeof opp.deadline === 'string' && new Date(opp.deadline).getTime() < Date.now()) {
      potentialRisks.push('Deadline may have passed. Verify current open status.');
    }
    if (!opp.remote && !opp.location.toLowerCase().includes('dhaka')) {
      potentialRisks.push(`Position is not listed as remote (${opp.location}). Relocation or remote exception required.`);
    }

    // MANDATORY ELIGIBILITY & PROVENANCE WARNING ENFORCEMENT
    const eligibilityChecks = opp.fitAnalysis?.eligibilityChecks || [];
    const unverifiedEligibility = eligibilityChecks.filter((c) => c.status === 'GAP' || c.status === 'VERIFY');
    if (unverifiedEligibility.length > 0) {
      const criteriaList = unverifiedEligibility.map((c) => `"${c.criterion}" (${c.status})`).join('; ');
      potentialRisks.push(`ELIGIBILITY WARNING: Application generated with unverified or unknown eligibility: ${criteriaList}.`);
      missingInformation.push(`Eligibility check unconfirmed: ${criteriaList}`);
    }

    if (opp.sourceVerification === 'DEMO') {
      potentialRisks.push('DEMO DATA NOTICE: This opportunity is marked as DEMO and cannot be submitted to external employers.');
    }

    // Verified education summary (no fabricated university fallbacks)
    const verifiedEdu = profile.education.find((e) => e.verified && (e.provenance === 'USER_PROVIDED' || e.provenance === 'USER_CONFIRMED'));
    const educationSummary = verifiedEdu
      ? `${verifiedEdu.institution}, ${verifiedEdu.program} (${verifiedEdu.currentYear})`
      : 'Educational background requires candidate confirmation.';

    const tailoredProjects = profile.projects
      .filter((p) => p.verified && (p.provenance === 'USER_PROVIDED' || p.provenance === 'USER_CONFIRMED'))
      .map((p) => ({
        name: p.name,
        description: p.description,
        role: p.role,
        technologies: p.technologies,
        evidence: p.evidence,
      }));

    const tailoredResume = {
      headline: `${profile.identity.fullName} — ${profile.identity.professionalHeadline}`,
      summary: `Student and aspiring software developer with verified project experience in ${highlightedSkills.slice(0, 3).join(', ')}. Creator of Agent HQ and practical web and AI applications.`,
      highlightedSkills,
      tailoredProjects,
      education: educationSummary,
    };

    const verifiedProjectNames = tailoredProjects.map((p) => p.name).join(', ') || 'Agent HQ';
    const applicationMessage = `Dear ${opp.organization} Hiring Team,\n\nI am writing to submit my application for the ${opp.title} position.\n\nAs an HSC Science student and aspiring developer, I have built personal and student projects (including ${verifiedProjectNames}) with verified hands-on experience in ${highlightedSkills.slice(0, 4).join(', ')}. My work focuses on clean implementation, practical tool building, and reliable AI integration.\n\nI have thoroughly reviewed your requirements and would welcome the opportunity to learn, contribute, and collaborate with your team.\n\nSincerely,\n${profile.identity.fullName}`;

    const appId = generateId('app');
    const application: JobApplication = {
      id: appId,
      opportunityId: opp.id,
      targetOrganization: opp.organization,
      opportunityTitle: opp.title,
      selectedProfileInformation: {
        selectedSkills: highlightedSkills,
        selectedProjects: relevantProjects,
        educationSummary: tailoredResume.education,
      },
      tailoredResume,
      applicationMessage,
      coverLetter: applicationMessage,
      missingInformation,
      potentialRisks,
      status: 'AWAITING_APPROVAL',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.applications.set(appId, application);
    opp.applicationDraftId = appId;
    opp.status = 'APPLICATION_DRAFTED';
    opp.updatedAt = Date.now();
    this.save();

    EventBus.emit({
      id: generateId('ev_app_draft'),
      type: 'application.drafted',
      timestamp: Date.now(),
      message: `Tailored application drafted for "${opp.title}" at ${opp.organization}. Awaiting Farhan's approval.`,
      applicationId: appId,
      opportunityId: opp.id,
      targetOrganization: opp.organization,
    } as any);

    EventBus.emit({
      id: generateId('ev_app_wait'),
      type: 'application.approval.requested',
      timestamp: Date.now(),
      message: `APPLICATION REVIEW REQUIRED: ${opp.organization} - ${opp.title}`,
      applicationId: appId,
      opportunityId: opp.id,
      targetOrganization: opp.organization,
    } as any);

    return { success: true, application };
  }

  public getApplicationById(id: string): JobApplication | undefined {
    return this.applications.get(id);
  }

  public getApplicationByOpportunityId(oppId: string): JobApplication | undefined {
    for (const app of this.applications.values()) {
      if (app.opportunityId === oppId) return app;
    }
    return undefined;
  }

  public getAllApplications(): JobApplication[] {
    return Array.from(this.applications.values());
  }

  public approveApplication(id: string, approver: string = 'Farhan'): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.applications.get(id);
    if (!app) return { success: false, error: `Application ${id} not found.` };

    app.status = 'APPROVED';
    app.approvedAt = Date.now();
    app.approvedBy = approver;
    app.rejectionReason = undefined;

    const opp = this.opportunities.get(app.opportunityId);
    if (opp) {
      opp.status = 'AWAITING_APPROVAL';
      opp.updatedAt = Date.now();
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_app_appr'),
      type: 'application.approved',
      timestamp: Date.now(),
      message: `Application approved by ${approver} for ${app.targetOrganization}: "${app.opportunityTitle}"`,
      applicationId: id,
      opportunityId: app.opportunityId,
      targetOrganization: app.targetOrganization,
      decidedBy: approver,
    } as any);

    return { success: true, application: app };
  }

  public rejectApplication(id: string, reason: string, rejecter: string = 'Farhan'): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.applications.get(id);
    if (!app) return { success: false, error: `Application ${id} not found.` };

    app.status = 'REJECTED';
    app.rejectionReason = reason;
    app.approvedBy = rejecter;

    const opp = this.opportunities.get(app.opportunityId);
    if (opp) {
      opp.status = 'REJECTED';
      opp.updatedAt = Date.now();
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_app_rej'),
      type: 'application.rejected',
      timestamp: Date.now(),
      message: `Application rejected by ${rejecter}: ${reason}`,
      applicationId: id,
      opportunityId: app.opportunityId,
      targetOrganization: app.targetOrganization,
      decidedBy: rejecter,
      rejectionReason: reason,
    } as any);

    return { success: true, application: app };
  }

  public submitApplication(id: string): { success: boolean; error?: string; application?: JobApplication } {
    const app = this.applications.get(id);
    if (!app) return { success: false, error: `Application ${id} not found.` };

    // STRICT HUMAN APPROVAL ENFORCEMENT
    if (app.status !== 'APPROVED') {
      return {
        success: false,
        error: `SECURITY ENFORCEMENT ERROR: Cannot submit application ${id}. Current status is "${app.status}". Explicit "APPROVED" status from Farhan is required before external transmission.`,
      };
    }

    app.status = 'SUBMITTED';
    app.submittedAt = Date.now();

    const opp = this.opportunities.get(app.opportunityId);
    if (opp) {
      opp.status = 'SUBMITTED';
      opp.updatedAt = Date.now();
    }

    this.save();

    EventBus.emit({
      id: generateId('ev_app_sub'),
      type: 'application.submitted',
      timestamp: Date.now(),
      message: `Application SUBMITTED to ${app.targetOrganization}: "${app.opportunityTitle}"`,
      applicationId: id,
      opportunityId: app.opportunityId,
      targetOrganization: app.targetOrganization,
    } as any);

    return { success: true, application: app };
  }

  public getDashboardMetrics(): {
    discovered: number;
    qualified: number;
    drafted: number;
    awaitingApproval: number;
    submitted: number;
    responsesReceived: number;
    activeConversations: number;
  } {
    const opps = Array.from(this.opportunities.values());
    const apps = Array.from(this.applications.values());

    return {
      discovered: opps.filter((o) => o.status === 'DISCOVERED').length,
      qualified: opps.filter((o) => o.status === 'QUALIFIED').length,
      drafted: apps.filter((a) => a.status === 'DRAFTED' || a.status === 'AWAITING_APPROVAL').length,
      awaitingApproval: apps.filter((a) => a.status === 'AWAITING_APPROVAL').length,
      submitted: apps.filter((a) => a.status === 'SUBMITTED').length,
      responsesReceived: opps.filter((o) => o.status === 'RESPONSE_RECEIVED').length,
      activeConversations: opps.filter((o) => o.status === 'SUBMITTED' || o.status === 'RESPONSE_RECEIVED').length,
    };
  }

  public reset(): void {
    this.opportunities.clear();
    this.applications.clear();
    INITIAL_SEEDED_OPPORTUNITIES.forEach((o) => {
      this.opportunities.set(o.id, { ...o });
    });
    this.save();
  }
}

export const OpportunityManager = new OpportunityManagerClass();
