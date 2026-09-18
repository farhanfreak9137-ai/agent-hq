import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Inbox,
  Star,
  Trash2,
  CheckCircle2,
  FileText,
  Shield,
  Sparkles,
  ExternalLink,
  Search,
  Send,
  CornerDownRight,
  Clock,
  Copy,
  Check,
  Download,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Edit3,
  Save,
  Building2,
  SendHorizontal,
  FileSpreadsheet,
  MessageSquare,
  MessageCircle,
  UserCheck,
} from 'lucide-react';
import { ExecutiveEmail, AGENT_DIRECTORY } from '../email/EmailTypes.ts';
import { EmailManager } from '../email/EmailManager.ts';
import { ArtifactManager } from '../artifacts/ArtifactManager.ts';
import { ApiClient } from '../services/ApiClient.ts';

interface EmailInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: ExecutiveEmail[];
}

type EmailFilter = 'all' | 'mission' | 'task' | 'starred' | 'outreach_staged' | 'outreach_sent' | 'recruiter_replies';

export const EmailInboxModal: React.FC<EmailInboxModalProps> = ({
  isOpen,
  onClose,
  emails,
}) => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    emails.length > 0 ? emails[0].id : null
  );
  const [filter, setFilter] = useState<EmailFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingDeliverable, setViewingDeliverable] = useState<{
    name: string;
    type: string;
    content?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Outreach integration state
  const [outreachEmails, setOutreachEmails] = useState<any[]>([]);
  const [selectedOutreachId, setSelectedOutreachId] = useState<string | null>(null);
  const [draftingJobs, setDraftingJobs] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBodyText, setEditBodyText] = useState('');

  // Incoming replies state (CRM Agent)
  const [replies, setReplies] = useState<any[]>([]);
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);
  const [pollingReplies, setPollingReplies] = useState(false);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [editingReplyDraft, setEditingReplyDraft] = useState(false);
  const [editReplyText, setEditReplyText] = useState('');

  const fetchOutreach = async () => {
    try {
      const rows = await ApiClient.getInstance().getOutreachEmails();
      if (rows) {
        setOutreachEmails(rows);
        if (rows.length > 0 && !selectedOutreachId) {
          const staged = rows.find((r: any) => r.status === 'staged') || rows[0];
          setSelectedOutreachId(staged.id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReplies = async () => {
    try {
      const rows = await ApiClient.getInstance().getReplies();
      if (rows) {
        setReplies(rows);
        if (rows.length > 0 && !selectedReplyId) {
          setSelectedReplyId(rows[0].id);
          setEditReplyText(rows[0].drafted_reply || '');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOutreach();
      fetchReplies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isOutreachMode = filter === 'outreach_staged' || filter === 'outreach_sent';
  const isRepliesMode = filter === 'recruiter_replies';

  // Filter executive reports
  const filteredExecutiveEmails = emails.filter((em) => {
    if (filter === 'mission' && em.category !== 'mission_report') return false;
    if (filter === 'task' && em.category !== 'task_report') return false;
    if (filter === 'starred' && !em.starred) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        em.subject.toLowerCase().includes(q) ||
        em.fromName.toLowerCase().includes(q) ||
        em.fromAddress.toLowerCase().includes(q) ||
        em.body.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter outreach emails
  const filteredOutreachEmails = outreachEmails.filter((item) => {
    if (filter === 'outreach_staged' && item.status !== 'staged' && item.status !== 'failed' && item.status !== 'sending') return false;
    if (filter === 'outreach_sent' && item.status !== 'sent') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.company.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q) ||
        item.recipient_email.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter recruiter replies
  const filteredReplies = replies.filter((rep) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rep.company.toLowerCase().includes(q) ||
        rep.from_email.toLowerCase().includes(q) ||
        rep.subject.toLowerCase().includes(q) ||
        rep.body_text.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeEmail = emails.find((e) => e.id === selectedEmailId) || filteredExecutiveEmails[0] || null;
  const activeOutreach = outreachEmails.find((o) => o.id === selectedOutreachId) || filteredOutreachEmails[0] || null;
  const activeReply = replies.find((r) => r.id === selectedReplyId) || filteredReplies[0] || null;

  const handleSelectEmail = (em: ExecutiveEmail) => {
    setSelectedEmailId(em.id);
    if (!em.read) {
      EmailManager.markAsRead(em.id);
    }
  };

  const handleSelectOutreach = (item: any) => {
    setSelectedOutreachId(item.id);
    setEditingDraft(false);
    setEditSubject(item.subject || '');
    setEditBodyText(item.body_text || '');
  };

  const handleSelectReply = (rep: any) => {
    setSelectedReplyId(rep.id);
    setEditingReplyDraft(false);
    setEditReplyText(rep.drafted_reply || '');
  };

  const handleDeleteEmail = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    EmailManager.deleteEmail(id);
    if (selectedEmailId === id) {
      const remaining = emails.filter((item) => item.id !== id);
      setSelectedEmailId(remaining[0]?.id || null);
    }
  };

  const handleToggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    EmailManager.toggleStarred(id);
  };

  const handleDraftFromSheet = async () => {
    setDraftingJobs(true);
    setSendFeedback(null);
    try {
      const res = await ApiClient.getInstance().draftOutreachFromSheet();
      if (res?.success) {
        setSendFeedback(`Generated ${res.count} tailored applications from spreadsheet into Outbox!`);
        await fetchOutreach();
        setFilter('outreach_staged');
      }
    } catch (err: any) {
      setSendFeedback(`Drafting failed: ${err?.message || err}`);
    } finally {
      setDraftingJobs(false);
    }
  };

  const handleSendAllStaggered = async () => {
    const stagedList = outreachEmails.filter((e) => e.status === 'staged');
    if (stagedList.length === 0) {
      setSendFeedback('No staged emails found to send.');
      return;
    }
    setSendingOutreach(true);
    setSendFeedback(`Dispatching ${stagedList.length} applications with safe 20s anti-spam intervals...`);
    try {
      const res = await ApiClient.getInstance().sendOutreachEmails(stagedList.map((e) => e.id));
      if (res?.success) {
        setSendFeedback(`Successfully dispatched ${res.sent} applications via your Gmail!`);
        await fetchOutreach();
      } else {
        setSendFeedback(`Send error: ${res?.error || 'Failed to dispatch'}`);
      }
    } catch (err: any) {
      setSendFeedback(`Send failed: ${err?.message || err}`);
    } finally {
      setSendingOutreach(false);
    }
  };

  const handleSendSingle = async (id: string) => {
    setSendingOutreach(true);
    setSendFeedback(null);
    try {
      const res = await ApiClient.getInstance().sendSingleOutreachEmail(id);
      if (res?.success) {
        setSendFeedback('Application email sent successfully through Gmail!');
        await fetchOutreach();
      } else {
        setSendFeedback(`Send failed: ${res?.error || 'Check Gmail credentials in Profile'}`);
      }
    } catch (err: any) {
      setSendFeedback(`Error: ${err?.message || err}`);
    } finally {
      setSendingOutreach(false);
    }
  };

  const handleDeleteOutreach = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ApiClient.getInstance().deleteOutreachEmail(id);
      await fetchOutreach();
      if (selectedOutreachId === id) {
        const remaining = outreachEmails.filter((o) => o.id !== id);
        setSelectedOutreachId(remaining[0]?.id || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDraftEdit = async (id: string) => {
    try {
      await ApiClient.getInstance().updateOutreachEmail(id, {
        subject: editSubject,
        body_text: editBodyText,
      });
      setEditingDraft(false);
      await fetchOutreach();
      setSendFeedback('Draft updated successfully.');
    } catch (err) {
      console.error(err);
    }
  };

  // Reply handlers
  const handlePollInboxNow = async () => {
    setPollingReplies(true);
    setSendFeedback(null);
    try {
      const res = await ApiClient.getInstance().pollReplies();
      if (res?.checked) {
        setSendFeedback(
          res.newReplies > 0
            ? `Found ${res.newReplies} new recruiter reply(s)! Discord alert triggered.`
            : 'Inbox checked: No new recruiter replies at this time.'
        );
        await fetchReplies();
      } else {
        setSendFeedback(`Check failed: ${res?.error || 'Check Gmail App Password'}`);
      }
    } catch (err: any) {
      setSendFeedback(`Poll error: ${err?.message || err}`);
    } finally {
      setPollingReplies(false);
    }
  };

  const handleSendFollowUp = async (id: string) => {
    setSendingFollowUp(true);
    setSendFeedback(null);
    try {
      const res = await ApiClient.getInstance().sendReply(id);
      if (res?.success) {
        setSendFeedback('Follow-up email dispatched successfully via Gmail!');
        await fetchReplies();
      } else {
        setSendFeedback(`Dispatch failed: ${res?.error || 'Check Gmail settings'}`);
      }
    } catch (err: any) {
      setSendFeedback(`Send error: ${err?.message || err}`);
    } finally {
      setSendingFollowUp(false);
    }
  };

  const handleSaveReplyDraft = async (id: string) => {
    try {
      await ApiClient.getInstance().updateReply(id, { drafted_reply: editReplyText });
      setEditingReplyDraft(false);
      await fetchReplies();
      setSendFeedback('Follow-up draft updated.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReply = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await ApiClient.getInstance().deleteReply(id);
      await fetchReplies();
      if (selectedReplyId === id) {
        const remaining = replies.filter((r) => r.id !== id);
        setSelectedReplyId(remaining[0]?.id || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const stagedCount = outreachEmails.filter((e) => e.status === 'staged').length;
  const sentCount = outreachEmails.filter((e) => e.status === 'sent').length;
  const newRepliesCount = replies.filter((r) => r.status === 'new').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[88vh] bg-slate-950 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-3.5 px-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Agent HQ Secure Mail & Outreach
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                  Gmail SMTP + IMAP + Discord Alerts
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Incoming executive reports, cold outreach dispatch queue, and automated recruiter reply tracking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail & jobs..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-44"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Folders */}
          <div className="w-52 bg-slate-900/50 border-r border-slate-800/80 p-3 space-y-1.5 flex flex-col select-none overflow-y-auto">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              Internal Reports
            </span>

            <button
              onClick={() => setFilter('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-3.5 h-3.5" />
                <span>Inbox</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {emails.length}
              </span>
            </button>

            <button
              onClick={() => setFilter('mission')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                filter === 'mission'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Mission Briefs</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {emails.filter((e) => e.category === 'mission_report').length}
              </span>
            </button>

            <button
              onClick={() => setFilter('task')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                filter === 'task'
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Task Reports</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {emails.filter((e) => e.category === 'task_report').length}
              </span>
            </button>

            <button
              onClick={() => setFilter('starred')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                filter === 'starred'
                  ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-yellow-400" />
                <span>Starred</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                {emails.filter((e) => e.starred).length}
              </span>
            </button>

            {/* Cold Outreach / Gmail Section */}
            <div className="pt-3 border-t border-slate-800/80 space-y-1">
              <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
                <Send className="w-3 h-3" /> Gmail Job Outreach
              </span>

              <button
                onClick={() => setFilter('outreach_staged')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filter === 'outreach_staged'
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Outbox (Staged)</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  stagedCount > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {stagedCount}
                </span>
              </button>

              <button
                onClick={() => setFilter('outreach_sent')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filter === 'outreach_sent'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sent via Gmail</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                  {sentCount}
                </span>
              </button>

              <button
                onClick={() => setFilter('recruiter_replies')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  filter === 'recruiter_replies'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recruiter Replies (CRM)</span>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  newRepliesCount > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-400'
                }`}>
                  {replies.length}
                </span>
              </button>
            </div>

            {/* Corporate Directory list */}
            <div className="pt-3 border-t border-slate-800/80 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                Direct Agent Roster
              </span>
              <div className="space-y-1 text-[11px] text-slate-400 px-2">
                {Object.values(AGENT_DIRECTORY).slice(0, 5).map((agent) => (
                  <div key={agent.email} className="truncate py-0.5 flex items-center gap-1.5">
                    <span className="text-xs">{agent.symbol}</span>
                    <span className="text-slate-300 font-medium">{agent.name}:</span>
                    <span className="text-slate-500 text-[10px] truncate">{agent.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column: Email List */}
          <div className="w-80 sm:w-96 bg-slate-950/70 border-r border-slate-800/80 overflow-y-auto divide-y divide-slate-900 flex flex-col">
            {/* Outreach Action Bar */}
            {isOutreachMode && (
              <div className="p-3 bg-slate-900/90 border-b border-slate-800 space-y-2 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-rose-400" />
                    {filter === 'outreach_staged' ? 'Applications in Outbox' : 'Sent Applications'}
                  </span>
                  <button
                    onClick={fetchOutreach}
                    title="Refresh outbox"
                    className="text-slate-400 hover:text-white transition p-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {filter === 'outreach_staged' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleDraftFromSheet}
                      disabled={draftingJobs}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      {draftingJobs ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                      ) : (
                        <FileSpreadsheet className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>Draft from Sheet</span>
                    </button>

                    <button
                      onClick={handleSendAllStaggered}
                      disabled={sendingOutreach || stagedCount === 0}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white text-[11px] font-bold shadow-md shadow-rose-500/20 flex items-center justify-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      {sendingOutreach ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <SendHorizontal className="w-3 h-3" />
                      )}
                      <span>Send All (20s Gap)</span>
                    </button>
                  </div>
                )}

                {sendFeedback && (
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{sendFeedback}</span>
                  </div>
                )}
              </div>
            )}

            {/* Recruiter Replies Action Bar */}
            {isRepliesMode && (
              <div className="p-3 bg-slate-900/90 border-b border-slate-800 space-y-2 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                    Recruiter Replies (IMAP)
                  </span>
                  <button
                    onClick={handlePollInboxNow}
                    disabled={pollingReplies}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${pollingReplies ? 'animate-spin' : ''}`} />
                    <span>Check Gmail Now</span>
                  </button>
                </div>

                {sendFeedback && (
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-300 font-mono flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{sendFeedback}</span>
                  </div>
                )}
              </div>
            )}

            {/* List Content */}
            {!isOutreachMode && !isRepliesMode ? (
              filteredExecutiveEmails.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs font-mono">
                  No communications found in this folder.
                </div>
              ) : (
                filteredExecutiveEmails.map((em) => {
                  const isSelected = activeEmail?.id === em.id;
                  const agent = em.agentId ? AGENT_DIRECTORY[em.agentId] : null;

                  return (
                    <div
                      key={em.id}
                      onClick={() => handleSelectEmail(em)}
                      className={`p-3 cursor-pointer transition flex gap-3 relative ${
                        isSelected
                          ? 'bg-cyan-950/30 border-l-2 border-cyan-400'
                          : !em.read
                          ? 'bg-slate-900/40 hover:bg-slate-900/60'
                          : 'hover:bg-slate-900/30 opacity-80'
                      }`}
                    >
                      {!em.read && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 absolute left-1 top-4" />
                      )}

                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-sm border"
                        style={{
                          backgroundColor: `${agent?.avatarColor || '#38bdf8'}20`,
                          borderColor: `${agent?.avatarColor || '#38bdf8'}40`,
                        }}
                      >
                        {agent?.symbol || '📨'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span
                            className={`text-xs truncate ${
                              !em.read ? 'text-white font-bold' : 'text-slate-300 font-medium'
                            }`}
                          >
                            {em.fromName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {new Date(em.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p
                          className={`text-xs truncate mb-0.5 ${
                            !em.read ? 'text-cyan-200 font-semibold' : 'text-slate-300'
                          }`}
                        >
                          {em.subject}
                        </p>

                        <p className="text-[11px] text-slate-500 truncate">{em.preview}</p>
                      </div>

                      <div className="flex flex-col items-center justify-between pt-0.5">
                        <button
                          onClick={(e) => handleToggleStar(em.id, e)}
                          className={`p-1 rounded transition cursor-pointer ${
                            em.starred ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : isRepliesMode ? (
              /* RECRUITER REPLIES LIST */
              filteredReplies.length === 0 ? (
                <div className="p-8 text-center text-slate-600 text-xs font-mono space-y-3">
                  <p>No recruiter replies detected yet.</p>
                  <button
                    onClick={handlePollInboxNow}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    Check Gmail Inbox Now
                  </button>
                </div>
              ) : (
                filteredReplies.map((rep) => {
                  const isSelected = activeReply?.id === rep.id;
                  return (
                    <div
                      key={rep.id}
                      onClick={() => handleSelectReply(rep)}
                      className={`p-3 cursor-pointer transition flex gap-3 relative ${
                        isSelected
                          ? 'bg-amber-950/30 border-l-2 border-amber-500'
                          : 'hover:bg-slate-900/30 opacity-80'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center text-xs shrink-0 font-bold">
                        {rep.company.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-bold text-white truncate">
                            {rep.company}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                              rep.intent === 'interview_invite'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : rep.intent === 'question'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : rep.intent === 'rejection'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rep.intent.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-xs text-amber-200 truncate font-semibold mb-0.5">
                          {rep.subject}
                        </p>

                        <p className="text-[11px] text-slate-500 truncate">
                          From: {rep.from_name || rep.from_email}
                        </p>
                      </div>

                      <button
                        onClick={(e) => handleDeleteReply(rep.id, e)}
                        className="text-slate-600 hover:text-rose-400 transition p-1 shrink-0 self-center cursor-pointer"
                        title="Delete reply"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )
            ) : filteredOutreachEmails.length === 0 ? (
              <div className="p-8 text-center text-slate-600 text-xs font-mono space-y-3">
                <p>No job application emails {filter === 'outreach_staged' ? 'staged' : 'sent'}.</p>
                {filter === 'outreach_staged' && (
                  <button
                    onClick={handleDraftFromSheet}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold hover:bg-rose-500/30 transition cursor-pointer"
                  >
                    Auto-Draft from Spreadsheet
                  </button>
                )}
              </div>
            ) : (
              filteredOutreachEmails.map((item) => {
                const isSelected = activeOutreach?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectOutreach(item)}
                    className={`p-3 cursor-pointer transition flex gap-3 relative ${
                      isSelected
                        ? 'bg-rose-950/30 border-l-2 border-rose-500'
                        : 'hover:bg-slate-900/30 opacity-80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center justify-center text-xs shrink-0 font-bold">
                      {item.company.charAt(0)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-bold text-white truncate">
                          {item.company}
                        </span>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold shrink-0 ${
                            item.status === 'sent'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : item.status === 'failed'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : item.status === 'sending'
                              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <p className="text-xs text-rose-200 truncate font-semibold mb-0.5">
                        {item.role}
                      </p>

                      <p className="text-[11px] text-slate-500 truncate">
                        To: {item.recipient_email}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDeleteOutreach(item.id, e)}
                      className="text-slate-600 hover:text-rose-400 transition p-1 shrink-0 self-center cursor-pointer"
                      title="Delete email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Reader & Workbench Pane */}
          <div className="flex-1 bg-slate-950 flex flex-col overflow-y-auto">
            {!isOutreachMode && !isRepliesMode ? (
              activeEmail ? (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {activeEmail.category.replace('_', ' ')}
                      </span>
                      <h3 className="text-base font-bold text-slate-100">
                        {activeEmail.subject}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleStar(activeEmail.id, e)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          activeEmail.starred
                            ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                            : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <Star className="w-4 h-4 fill-current" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteEmail(activeEmail.id, e)}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sender Card */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-base border shadow-sm"
                        style={{
                          backgroundColor: `${
                            activeEmail.agentId
                              ? AGENT_DIRECTORY[activeEmail.agentId]?.avatarColor || '#38bdf8'
                              : '#38bdf8'
                          }20`,
                          borderColor: `${
                            activeEmail.agentId
                              ? AGENT_DIRECTORY[activeEmail.agentId]?.avatarColor || '#38bdf8'
                              : '#38bdf8'
                          }40`,
                        }}
                      >
                        {activeEmail.agentId ? AGENT_DIRECTORY[activeEmail.agentId]?.symbol : '📨'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{activeEmail.fromName}</span>
                          <span className="text-[11px] font-mono text-slate-500">&lt;{activeEmail.fromAddress}&gt;</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <span>To:</span>
                          <span className="text-cyan-400 font-semibold">{activeEmail.toName}</span>
                          <span className="text-slate-500">&lt;{activeEmail.toAddress}&gt;</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3 inline mr-1 text-slate-600" />
                      {new Date(activeEmail.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {activeEmail.body}
                  </div>

                  {activeEmail.deliverables && activeEmail.deliverables.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Attached Deliverables ({activeEmail.deliverables.length})
                        </span>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          Direct Links to Artifact Store
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeEmail.deliverables.map((del, i) => (
                          <div
                            key={i}
                            onClick={() => {
                              const art = ArtifactManager.getInstance().getById(del.id);
                              setViewingDeliverable({
                                name: del.title,
                                type: del.type,
                                content: art?.content || (del as any).content || 'No content available.',
                              });
                            }}
                            className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition flex items-center justify-between cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate block">
                                  {del.title}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 uppercase">
                                  {del.type}
                                </span>
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs font-mono p-6">
                  <Mail className="w-12 h-12 mb-3 stroke-[1.2] opacity-40 text-slate-500" />
                  Select an email to view its full neural contents.
                </div>
              )
            ) : isRepliesMode ? (
              /* RECRUITER REPLY DETAIL & FOLLOW-UP WORKBENCH */
              activeReply ? (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                            activeReply.intent === 'interview_invite'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : activeReply.intent === 'question'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : activeReply.intent === 'rejection'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {activeReply.intent.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Status: {activeReply.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-100">
                        {activeReply.company} — {activeReply.subject}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendFollowUp(activeReply.id)}
                        disabled={sendingFollowUp || activeReply.status === 'replied'}
                        className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                      >
                        {sendingFollowUp ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{activeReply.status === 'replied' ? 'Replied' : 'Send Reply via Gmail'}</span>
                      </button>

                      <button
                        onClick={(e) => handleDeleteReply(activeReply.id, e)}
                        className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete reply"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Recruiter Sender Info */}
                  <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-sm shadow-sm">
                        {activeReply.company.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{activeReply.from_name || activeReply.company}</span>
                          <span className="text-[11px] font-mono text-slate-400">&lt;{activeReply.from_email}&gt;</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <span>Target:</span>
                          <span className="text-amber-400 font-semibold">{activeReply.company}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 font-mono">
                      <Clock className="w-3 h-3 inline mr-1 text-slate-600" />
                      {new Date(activeReply.received_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Recruiter's Message */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Recruiter's Message
                    </label>
                    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                      {activeReply.body_text}
                    </div>
                  </div>

                  {/* Auto-Drafted Follow-Up Response */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        CRM & Outreach Agent: Tailored Follow-Up Response
                      </label>
                      <button
                        onClick={() => {
                          if (editingReplyDraft) {
                            handleSaveReplyDraft(activeReply.id);
                          } else {
                            setEditingReplyDraft(true);
                            setEditReplyText(activeReply.drafted_reply || '');
                          }
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                      >
                        {editingReplyDraft ? <Save className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                        <span>{editingReplyDraft ? 'Save Draft' : 'Edit Response'}</span>
                      </button>
                    </div>

                    {editingReplyDraft ? (
                      <textarea
                        rows={10}
                        value={editReplyText}
                        onChange={(e) => setEditReplyText(e.target.value)}
                        className="w-full p-4 rounded-xl bg-slate-900 border border-amber-500/50 text-slate-100 text-xs font-mono leading-relaxed focus:outline-none"
                      />
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900/30 border border-amber-500/30 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap selection:bg-amber-500/20">
                        {activeReply.drafted_reply}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs font-mono p-6">
                  <MessageSquare className="w-12 h-12 mb-3 stroke-[1.2] opacity-40 text-slate-500" />
                  Select a recruiter reply from the list to preview the message and response.
                </div>
              )
            ) : activeOutreach ? (
              /* OUTREACH APPLICATION WORKBENCH */
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold">
                        Job Application Email
                      </span>
                      <span
                        className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                          activeOutreach.status === 'sent'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : activeOutreach.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {activeOutreach.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">
                      {activeOutreach.company} — {activeOutreach.role}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {activeOutreach.status === 'staged' && (
                      <>
                        <button
                          onClick={() => {
                            if (editingDraft) {
                              handleSaveDraftEdit(activeOutreach.id);
                            } else {
                              setEditingDraft(true);
                              setEditSubject(activeOutreach.subject);
                              setEditBodyText(activeOutreach.body_text);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          {editingDraft ? (
                            <>
                              <Save className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Save Edits</span>
                            </>
                          ) : (
                            <>
                              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Edit Draft</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleSendSingle(activeOutreach.id)}
                          disabled={sendingOutreach}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        >
                          {sendingOutreach ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Send via Gmail</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={(e) => handleDeleteOutreach(activeOutreach.id, e)}
                      className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition cursor-pointer"
                      title="Delete draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300 font-bold text-sm shadow-sm">
                      {activeOutreach.company.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{activeOutreach.company}</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          Recipient: {activeOutreach.recipient_name || 'Hiring Team'} &lt;{activeOutreach.recipient_email}&gt;
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <span>Position Target:</span>
                        <span className="text-cyan-400 font-semibold">{activeOutreach.role}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3 inline mr-1 text-slate-600" />
                    {activeOutreach.sent_at
                      ? `Sent: ${new Date(activeOutreach.sent_at).toLocaleString()}`
                      : `Created: ${new Date(activeOutreach.created_at).toLocaleDateString()}`}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Subject Line
                  </label>
                  {editingDraft ? (
                    <input
                      type="text"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold focus:border-rose-500 outline-none"
                    />
                  ) : (
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-bold text-slate-100">
                      {activeOutreach.subject}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Application Pitch & Tailored Content
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Includes Farhan's Portfolio, GitHub & Resume
                    </span>
                  </div>

                  {editingDraft ? (
                    <textarea
                      rows={14}
                      value={editBodyText}
                      onChange={(e) => setEditBodyText(e.target.value)}
                      className="w-full p-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono leading-relaxed focus:border-rose-500 outline-none"
                    />
                  ) : (
                    <div
                      className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap selection:bg-rose-500/20"
                    >
                      {activeOutreach.body_text}
                    </div>
                  )}
                </div>

                {activeOutreach.attachments && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Attachments Included
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {JSON.parse(activeOutreach.attachments || '[]').map((file: string, idx: number) => (
                        <div
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono flex items-center gap-2"
                        >
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{file}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs font-mono p-6">
                <Building2 className="w-12 h-12 mb-3 stroke-[1.2] opacity-40 text-slate-500" />
                Select an item from the list to preview.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deliverable Full-Screen Viewer */}
      {viewingDeliverable && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl h-[85vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 px-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    {viewingDeliverable.name}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400 uppercase">
                      {viewingDeliverable.type}
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Workspace Verified Deliverable
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingDeliverable.content) {
                      navigator.clipboard.writeText(viewingDeliverable.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                  title="Copy content to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!viewingDeliverable.content) return;
                    const blob = new Blob([viewingDeliverable.content], {
                      type: 'text/markdown;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${viewingDeliverable.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-slate-600 transition-all cursor-pointer"
                  title="Export deliverable as Markdown"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Export</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingDeliverable(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950/60 font-mono text-xs md:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 custom-scrollbar">
              {viewingDeliverable.content}
            </div>

            <div className="px-6 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                Agent HQ Secure Document Engine v2.5
              </span>
              <span className="text-emerald-400 font-medium">
                Cryptographic signature verified • SHA-256 Validated
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
