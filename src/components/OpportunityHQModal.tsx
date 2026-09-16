import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Compass,
  Briefcase,
  GraduationCap,
  Trophy,
  GitPullRequest,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  FileText,
  Send,
  AlertTriangle,
  Search,
  Filter,
  Check,
  Ban,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  Opportunity,
  OpportunityStatus,
  OpportunityType,
  JobApplication,
  SourceVerification,
} from '../types/index.ts';
import { OpportunityManager } from '../opportunity/OpportunityManager.ts';
import { EventBus } from '../events/EventBus.ts';

interface OpportunityHQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryTab =
  | 'all'
  | 'internship'
  | 'job'
  | 'freelance'
  | 'hackathon'
  | 'competition'
  | 'open_source'
  | 'applications'
  | 'deadlines';

export const OpportunityHQModal: React.FC<OpportunityHQModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() =>
    OpportunityManager.getAllOpportunities()
  );
  const [applications, setApplications] = useState<JobApplication[]>(() =>
    OpportunityManager.getAllApplications()
  );
  const [metrics, setMetrics] = useState(() => OpportunityManager.getDashboardMetrics());

  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [remoteOnly, setRemoteOnly] = useState<boolean>(false);

  // Application Review Gate Modal State
  const [reviewingAppId, setReviewingAppId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const refreshState = () => {
    setOpportunities([...OpportunityManager.getAllOpportunities()]);
    setApplications([...OpportunityManager.getAllApplications()]);
    setMetrics(OpportunityManager.getDashboardMetrics());
  };

  useEffect(() => {
    const unsub = EventBus.on('*', (ev) => {
      const t = (ev as any)?.type as string;
      if (
        t?.startsWith('opportunity.') ||
        t?.startsWith('application.') ||
        t === 'simulation.reset'
      ) {
        refreshState();
      }
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleMatchOpportunity = (id: string) => {
    const res = OpportunityManager.matchOpportunity(id);
    if (res.success) {
      refreshState();
      showFeedback(`Profile matched: ${res.fitAnalysis?.matchPercentage}% requirement alignment.`);
    }
  };

  const handleTailorAndDraft = (id: string) => {
    const res = OpportunityManager.tailorResumeAndDraft(id);
    if (res.success && res.application) {
      refreshState();
      setReviewingAppId(res.application.id);
      showFeedback(`Tailored resume & application drafted. Awaiting review.`);
    }
  };

  const handleApproveApp = (appId: string) => {
    const res = OpportunityManager.approveApplication(appId);
    if (res.success) {
      refreshState();
      showFeedback('Application explicitly approved for submission!');
    }
  };

  const handleRejectApp = (appId: string) => {
    const res = OpportunityManager.rejectApplication(appId, rejectReason || 'Operator rejection');
    if (res.success) {
      refreshState();
      setIsRejecting(false);
      setRejectReason('');
      showFeedback('Application rejected.');
    }
  };

  const handleSubmitApp = (appId: string) => {
    const res = OpportunityManager.submitApplication(appId);
    if (!res.success) {
      showFeedback(res.error || 'Submission failed.', 'error');
    } else {
      refreshState();
      showFeedback('Application submitted to target organization successfully!');
    }
  };

  // Filter opportunities
  const filteredOpps = opportunities.filter((opp) => {
    if (activeTab !== 'all' && activeTab !== 'applications' && activeTab !== 'deadlines') {
      if (opp.type !== activeTab) return false;
    }
    if (activeTab === 'deadlines' && !opp.deadline) return false;
    if (remoteOnly && !opp.remote) return false;
    if (statusFilter !== 'ALL' && opp.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        opp.title.toLowerCase().includes(q) ||
        opp.organization.toLowerCase().includes(q) ||
        opp.requirements.some((r) => r.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeReviewApp = reviewingAppId
    ? applications.find((a) => a.id === reviewingAppId) || null
    : null;

  const getStatusBadge = (status: OpportunityStatus | string) => {
    switch (status) {
      case 'QUALIFIED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'APPLICATION_DRAFTED':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'AWAITING_APPROVAL':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse';
      case 'SUBMITTED':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'RESPONSE_RECEIVED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'REJECTED':
      case 'CLOSED':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getTypeBadge = (type: OpportunityType) => {
    switch (type) {
      case 'internship':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'job':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'hackathon':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'freelance':
        return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getVerificationBadge = (verification?: SourceVerification | string) => {
    switch (verification) {
      case 'DEMO':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border bg-amber-500/20 text-amber-300 border-amber-500/40 tracking-wide inline-flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Demo Data
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border bg-emerald-500/20 text-emerald-300 border-emerald-500/40 tracking-wide inline-flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Verified Source
          </span>
        );
      case 'UNVERIFIED':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-slate-800 text-slate-400 border-slate-700 tracking-wide inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Unverified
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-7xl h-[90vh] bg-slate-950 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-extrabold">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">
                  Opportunity HQ
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-semibold flex items-center gap-1 font-mono">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  REAL ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Discovers legitimate public opportunities, performs transparent requirement matching against Farhan's Profile, and prepares tailored applications with human sign-off.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {feedbackMessage && (
              <span
                className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800'
                }`}
              >
                {feedbackMessage.text}
              </span>
            )}
            <button
              onClick={refreshState}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real Metrics Summary Bar */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400">Discovered</span>
            <span className="text-base font-extrabold text-slate-100 font-mono">{metrics.discovered}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-emerald-400">Qualified</span>
            <span className="text-base font-extrabold text-emerald-300 font-mono">{metrics.qualified}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Drafted</span>
            <span className="text-base font-extrabold text-cyan-300 font-mono">{metrics.drafted}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-purple-400">Awaiting Farhan</span>
            <span className="text-base font-extrabold text-purple-300 font-mono flex items-center gap-1">
              {metrics.awaitingApproval}
              {metrics.awaitingApproval > 0 && <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-blue-400">Submitted</span>
            <span className="text-base font-extrabold text-blue-300 font-mono">{metrics.submitted}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-amber-400">Responses</span>
            <span className="text-base font-extrabold text-amber-300 font-mono">{metrics.responsesReceived}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400">Active Pipeline</span>
            <span className="text-base font-extrabold text-slate-200 font-mono">{metrics.activeConversations}</span>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div className="px-6 bg-slate-950 border-b border-slate-800 flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'all', label: 'All Opportunities' },
            { id: 'internship', label: 'Internships' },
            { id: 'job', label: 'Full-Time Jobs' },
            { id: 'freelance', label: 'Freelance & Contract' },
            { id: 'hackathon', label: 'Hackathons' },
            { id: 'applications', label: `Applications (${applications.length})` },
            { id: 'deadlines', label: 'Deadlines' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CategoryTab)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="p-3 px-6 bg-slate-900/30 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, organization, or skill..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-900 border-slate-800"
              />
              <span className="text-slate-300 text-xs font-medium">Remote Only</span>
            </label>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="DISCOVERED">Discovered</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="APPLICATION_DRAFTED">Drafted</option>
                <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                <option value="SUBMITTED">Submitted</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area: Cards List OR Applications List */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60">
          {activeTab === 'applications' ? (
            /* Applications Table / View */
            <div className="space-y-3">
              {applications.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  No applications drafted yet. Select an opportunity and click "Tailor Resume & Draft".
                </div>
              ) : (
                applications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-100 text-sm">{app.opportunityTitle}</span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-300 font-semibold">{app.targetOrganization}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(app.status)}`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-slate-400 line-clamp-1 max-w-2xl">{app.applicationMessage}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReviewingAppId(app.id)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow transition cursor-pointer"
                      >
                        Review Dossier
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Opportunities Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOpps.length === 0 ? (
                <div className="col-span-3 text-center py-16 text-slate-400 text-xs">
                  No opportunities match the current filters.
                </div>
              ) : (
                filteredOpps.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-slate-700 transition shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                            {opp.organization}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100 leading-snug">{opp.title}</h4>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border whitespace-nowrap ${getTypeBadge(opp.type)}`}>
                            {opp.type}
                          </span>
                          {getVerificationBadge(opp.sourceVerification)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>{opp.remote ? 'Remote' : opp.location}</span>
                        {opp.deadline && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 text-amber-400">
                              <Clock className="w-3 h-3" /> Due {opp.deadline}
                            </span>
                          </>
                        )}
                        <span>&bull;</span>
                        <a
                          href={opp.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-cyan-400 flex items-center gap-0.5"
                          title="View Verified Source"
                        >
                          Source <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      <p className="text-slate-300 text-xs line-clamp-2 leading-relaxed">{opp.description}</p>

                      {/* Required Skills */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Target Requirements
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {opp.requirements.map((r, ri) => {
                            const isMatched = opp.matchedSkills?.includes(r);
                            return (
                              <span
                                key={ri}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                  isMatched
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                }`}
                              >
                                {r}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Transparent Fit Analysis (if run) */}
                      {opp.fitAnalysis && (
                        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-cyan-300">Profile Requirement Match</span>
                            <span className="font-mono text-emerald-400">{opp.fitAnalysis.matchPercentage}%</span>
                          </div>
                          {opp.evidence && opp.evidence.length > 0 && (
                            <span className="text-slate-400 block text-[10px] truncate">
                              Evidence: {opp.evidence.join(', ')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(opp.status)}`}>
                        {opp.status}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleMatchOpportunity(opp.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                        >
                          Match
                        </button>
                        <button
                          onClick={() => handleTailorAndDraft(opp.id)}
                          className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition cursor-pointer"
                        >
                          Tailor & Draft
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* APPLICATION REVIEW GATE MODAL */}
        {activeReviewApp && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150">
            <div className="w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-cyan-800/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-xs">
              {/* Review Header */}
              <div className="p-4 px-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-100 uppercase tracking-wider">
                      Application Review Gate &mdash; Farhan Authorization
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      External submission strictly prohibited without explicit human operator sign-off.
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setReviewingAppId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Review Dossier Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4 text-slate-200">
                {/* Notice Banners */}
                {(opportunities.find((o) => o.id === activeReviewApp.opportunityId)?.sourceVerification === 'DEMO' ||
                  activeReviewApp.potentialRisks.some((r) => r.includes('DEMO'))) && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-200 text-xs">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-amber-300 uppercase tracking-wider text-[11px]">
                          DEMO / SIMULATED DATASET NOTICE
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          NON-PRODUCTION
                        </span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed text-[11px]">
                        This opportunity originates from a seeded test/demonstration dataset. Submissions cannot be dispatched to live external organizations without verified production sourcing.
                      </p>
                    </div>
                  </div>
                )}

                {activeReviewApp.potentialRisks.some((r) => r.includes('ELIGIBILITY WARNING')) && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl flex items-start gap-3 text-rose-200 text-xs">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-rose-300 uppercase tracking-wider text-[11px]">
                          CRITICAL ELIGIBILITY WARNING
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          VERIFICATION REQUIRED
                        </span>
                      </div>
                      <p className="text-rose-200/90 leading-relaxed text-[11px]">
                        Authoritative profile records do not fully verify all eligibility criteria for this opportunity (e.g. academic standing or prerequisite requirements). Explicit human verification is required.
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. Target & Opportunity Summary */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">TARGET ORGANIZATION</span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-100 text-sm">{activeReviewApp.targetOrganization}</span>
                      {getVerificationBadge(
                        opportunities.find((o) => o.id === activeReviewApp.opportunityId)?.sourceVerification || 'UNVERIFIED'
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">OPPORTUNITY TITLE</span>
                    <span className="font-bold text-cyan-300 text-sm">{activeReviewApp.opportunityTitle}</span>
                  </div>
                </div>

                {/* 2. Tailored Resume & Selected Profile Information */}
                <div className="space-y-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 uppercase tracking-wide">
                      Tailored Resume Presentation
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold">
                      100% Verified Profile Facts
                    </span>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 space-y-2 text-[11px]">
                    <p className="font-semibold text-slate-100">{activeReviewApp.tailoredResume.headline}</p>
                    <p className="text-slate-300 leading-relaxed">{activeReviewApp.tailoredResume.summary}</p>
                    <div>
                      <span className="text-slate-400 block mb-1 font-bold">Highlighted Skills:</span>
                      <div className="flex flex-wrap gap-1">
                        {activeReviewApp.tailoredResume.highlightedSkills.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Tailored Application Message */}
                <div className="space-y-1.5 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                  <span className="font-bold text-slate-300 uppercase tracking-wide">
                    Application Message / Cover Letter
                  </span>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 whitespace-pre-line text-slate-300 font-sans text-xs leading-relaxed">
                    {activeReviewApp.applicationMessage}
                  </div>
                </div>

                {/* 4. Missing Information & Potential Risks */}
                {(activeReviewApp.missingInformation.length > 0 || activeReviewApp.potentialRisks.length > 0) && (
                  <div className="p-3 bg-amber-950/20 rounded-xl border border-amber-800/40 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Missing Requirements & Potential Risks Audit</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-300/80 text-[11px] space-y-0.5">
                      {activeReviewApp.missingInformation.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                      {activeReviewApp.potentialRisks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Review Gate Actions */}
              <div className="p-4 px-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">Current State:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(activeReviewApp.status)}`}>
                    {activeReviewApp.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isRejecting ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Rejection reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs outline-none"
                      />
                      <button
                        onClick={() => handleRejectApp(activeReviewApp.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setIsRejecting(false)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsRejecting(true)}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-semibold text-xs transition cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 inline mr-1" /> Reject
                      </button>

                      {activeReviewApp.status !== 'APPROVED' ? (
                        <button
                          onClick={() => handleApproveApp(activeReviewApp.id)}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 inline mr-1" /> Approve Application
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubmitApp(activeReviewApp.id)}
                          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 inline mr-1" /> Submit Application
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
