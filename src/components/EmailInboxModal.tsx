import React, { useState } from 'react';
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
} from 'lucide-react';
import { ExecutiveEmail, AGENT_DIRECTORY } from '../email/EmailTypes.ts';
import { EmailManager } from '../email/EmailManager.ts';

interface EmailInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  emails: ExecutiveEmail[];
}

export const EmailInboxModal: React.FC<EmailInboxModalProps> = ({
  isOpen,
  onClose,
  emails,
}) => {
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(
    emails.length > 0 ? emails[0].id : null
  );
  const [filter, setFilter] = useState<'all' | 'mission' | 'task' | 'starred'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // Filter emails
  const filteredEmails = emails.filter((em) => {
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

  const activeEmail = emails.find((e) => e.id === selectedEmailId) || filteredEmails[0] || null;

  const handleSelectEmail = (em: ExecutiveEmail) => {
    setSelectedEmailId(em.id);
    if (!em.read) {
      EmailManager.markAsRead(em.id);
    }
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-6xl h-[86vh] bg-slate-950 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-3.5 px-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Executive Secure Mail
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-semibold">
                  agent.internal (Encrypted)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Direct neural reports & verified mission deliverables delivered to Commander.
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
                placeholder="Search reports..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-500 w-44"
              />
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 3-Column Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Folders */}
          <div className="w-48 bg-slate-900/50 border-r border-slate-800/80 p-3 space-y-1.5 flex flex-col select-none">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2 pb-1">
              Mailbox Folders
            </span>

            <button
              onClick={() => setFilter('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
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

            {/* Corporate Directory list */}
            <div className="pt-4 border-t border-slate-800/80 space-y-1">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-2">
                Direct Agent Roster
              </span>
              <div className="space-y-1 text-[11px] text-slate-400 px-2">
                {Object.values(AGENT_DIRECTORY).map((agent) => (
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
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-slate-600 text-xs font-mono">
                No communications found in this folder.
              </div>
            ) : (
              filteredEmails.map((em) => {
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
                    {/* Unread dot */}
                    {!em.read && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400 absolute left-1 top-4" />
                    )}

                    {/* Avatar Symbol */}
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
                        className={`p-1 rounded transition ${
                          em.starred ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Email Reader Pane */}
          <div className="flex-1 bg-slate-950 flex flex-col overflow-y-auto">
            {activeEmail ? (
              <div className="p-6 space-y-5">
                {/* Header Controls */}
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
                      className={`p-1.5 rounded-lg border transition ${
                        activeEmail.starred
                          ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                          : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteEmail(activeEmail.id, e)}
                      className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition"
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

                {/* Body Content */}
                <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/60 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                  {activeEmail.body}
                </div>

                {/* Attached Deliverables (if present) */}
                {activeEmail.deliverables && activeEmail.deliverables.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                      Attached Deliverables ({activeEmail.deliverables.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {activeEmail.deliverables.map((del, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start justify-between gap-2"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-slate-200 text-xs truncate">{del.name}</p>
                              <span className="text-[10px] font-mono text-slate-500 uppercase">
                                {del.type}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Verified
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs space-y-2">
                <Mail className="w-8 h-8 text-slate-700" />
                <p>Select a transmission to view report details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
