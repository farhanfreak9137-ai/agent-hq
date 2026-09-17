import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  User,
  GraduationCap,
  Wrench,
  FolderGit2,
  Briefcase,
  Layers,
  Link as LinkIcon,
  FileText,
  Lock,
  Eye,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Save,
  Check,
  ExternalLink,
  Award,
  Copy,
  ChevronRight,
} from 'lucide-react';
import {
  ProfessionalProfile,
  ProfileSuggestion,
  ProfileVisibility,
  ResumeVariant,
} from '../types/index.ts';
import { ProfileManager } from '../profile/ProfileManager.ts';

interface FarhanProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabSection =
  | 'profile'
  | 'education'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'certifications'
  | 'services'
  | 'links'
  | 'documents'
  | 'privacy';

export const FarhanProfileModal: React.FC<FarhanProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabSection>('profile');
  const [profile, setProfile] = useState<ProfessionalProfile>(() =>
    ProfileManager.getProfile('FULL')
  );
  const [suggestions, setSuggestions] = useState<ProfileSuggestion[]>(() =>
    ProfileManager.getSuggestions('PENDING')
  );
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeVariant, setActiveVariant] = useState<ResumeVariant>('master');
  const [copiedResume, setCopiedResume] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProfile(ProfileManager.getProfile('FULL'));
      setSuggestions(ProfileManager.getSuggestions('PENDING'));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const completeness = ProfileManager.getProfileCompleteness();

  const handleSave = () => {
    const res = ProfileManager.updateProfile(profile, true);
    if (res.success && res.profile) {
      setProfile({ ...res.profile });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  const handleApproveSuggestion = (id: string) => {
    const res = ProfileManager.approveSuggestion(id);
    if (res.success && res.profile) {
      setProfile({ ...res.profile });
      setSuggestions(ProfileManager.getSuggestions('PENDING'));
    }
  };

  const handleRejectSuggestion = (id: string) => {
    ProfileManager.rejectSuggestion(id);
    setSuggestions(ProfileManager.getSuggestions('PENDING'));
  };

  const toggleVisibility = (current: ProfileVisibility): ProfileVisibility => {
    if (current === 'PUBLIC') return 'APPLICATION_ONLY';
    if (current === 'APPLICATION_ONLY') return 'PRIVATE';
    return 'PUBLIC';
  };

  const getVisibilityBadge = (vis: ProfileVisibility) => {
    switch (vis) {
      case 'PUBLIC':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" /> Public
          </span>
        );
      case 'APPLICATION_ONLY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Briefcase className="w-2.5 h-2.5" /> Application Only
          </span>
        );
      case 'PRIVATE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Private
          </span>
        );
    }
  };

  const getProvenanceBadge = (provenance?: string, verified?: boolean) => {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {provenance === 'USER_CONFIRMED' ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/50 flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-2.5 h-2.5 text-teal-400" /> USER CONFIRMED
          </span>
        ) : provenance === 'USER_PROVIDED' ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> USER PROVIDED
          </span>
        ) : provenance === 'AGENT_SUGGESTED' ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-purple-500/20 text-purple-300 border border-purple-500/50 flex items-center gap-1 shadow-sm">
            <Sparkles className="w-2.5 h-2.5 text-purple-400" /> AGENT SUGGESTED
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1 shadow-sm">
            <AlertCircle className="w-2.5 h-2.5 text-amber-400" /> SYSTEM IMPORTED
          </span>
        )}
        {verified ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" /> VERIFIED
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5 text-rose-400" /> REQUIRES USER CONFIRMATION
          </span>
        )}
      </div>
    );
  };

  const currentResume = ProfileManager.generateResume(activeVariant);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-6xl h-[90vh] bg-slate-950 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white font-extrabold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">
                  Farhan Professional Profile
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  AUTHORITATIVE STORE (USER_CONFIRMED)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative source of truth for Farhan. Agents may read and recommend, but cannot mutate facts without explicit human authorization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow transition cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
            >
              {saveSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saveSuccess ? 'Saved Authoritative' : 'Save Changes'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pending Agent Suggestions Banner */}
        {suggestions.length > 0 && (
          <div className="px-6 py-2.5 bg-purple-950/40 border-b border-purple-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
              <span className="font-semibold">
                {suggestions.length} Agent-Suggested Profile Update{suggestions.length > 1 ? 's' : ''} Awaiting Farhan&apos;s Confirmation
              </span>
            </div>
            <div className="flex items-center gap-2">
              {suggestions.map((sug) => (
                <div key={sug.id} className="flex items-center gap-2 bg-slate-900/90 px-2.5 py-1 rounded border border-purple-800/70 text-[11px]">
                  <span className="text-purple-300 font-mono">[{sug.agentId.toUpperCase()} &rarr; {sug.section}]</span>
                  <span className="text-slate-300 truncate max-w-xs">{sug.reason}</span>
                  <button
                    onClick={() => handleApproveSuggestion(sug.id)}
                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => handleRejectSuggestion(sug.id)}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Layout: Left Nav Tabs + Right Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <nav className="w-64 bg-slate-900/50 border-r border-slate-800/80 p-3 flex flex-col gap-1 overflow-y-auto">
            {/* PROFILE COMPLETENESS WIDGET */}
            <div className="p-3 mb-2 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono shadow-inner">
              <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>PROFILE COMPLETENESS</span>
                <span className="text-emerald-400 font-bold">{completeness.score}%</span>
              </div>
              <div className="text-[10px] text-slate-600 font-mono mb-2 tracking-tighter">━━━━━━━━━━━━━━━━━━━━━━</div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between items-center">
                  <span>Identity</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Education</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Projects</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Skills</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Experience</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Certifications</span>
                  <span className="text-slate-500 font-bold">—</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Achievements</span>
                  <span className="text-slate-500 font-bold">—</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Documents</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[9px] text-slate-400 leading-tight">
                *Legitimate &apos;none&apos; fields (—) not penalized
              </div>
            </div>

            {[
              { id: 'profile', label: 'Identity & Bio', icon: <User className="w-4 h-4" /> },
              { id: 'education', label: 'Education', icon: <GraduationCap className="w-4 h-4" /> },
              { id: 'skills', label: 'Skills & Tech', icon: <Wrench className="w-4 h-4" /> },
              { id: 'projects', label: 'Projects (5 Confirmed)', icon: <FolderGit2 className="w-4 h-4" /> },
              { id: 'experience', label: 'Work Experience', icon: <Briefcase className="w-4 h-4" /> },
              { id: 'certifications', label: 'Certifications & Awards', icon: <Award className="w-4 h-4" /> },
              { id: 'services', label: 'Services Offered', icon: <Layers className="w-4 h-4" /> },
              { id: 'links', label: 'Links & Profiles', icon: <LinkIcon className="w-4 h-4" /> },
              { id: 'documents', label: 'Resume Studio', icon: <FileText className="w-4 h-4" /> },
              { id: 'privacy', label: 'Privacy Controls', icon: <Lock className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabSection)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Section Panel */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60 text-slate-200 text-xs">
            {/* 1. PROFILE / IDENTITY */}
            {activeTab === 'profile' && (
              <div className="space-y-5 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-cyan-400" /> Identity Information
                  </h3>
                  <span className="text-[11px] text-slate-400">Authoritative USER_CONFIRMED</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={profile.identity.fullName}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, fullName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Professional Name</label>
                    <input
                      type="text"
                      value={profile.identity.professionalName || ''}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, professionalName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 font-semibold"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-slate-400 font-medium block mb-1">Professional Headline</label>
                    <input
                      type="text"
                      value={profile.identity.professionalHeadline}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, professionalHeadline: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Primary Email</label>
                    <input
                      type="email"
                      value={profile.identity.email}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, email: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Location</label>
                    <input
                      type="text"
                      value={profile.identity.location}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, location: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100"
                    />
                  </div>
                </div>

                {/* Primary Development Interests */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <span className="text-slate-300 font-bold text-xs uppercase tracking-wider block">
                    Primary Development Interests
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.identity.primaryInterests?.map((interest, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={profile.identity.bio || ''}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        identity: { ...profile.identity, bio: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 text-xs leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* 2. EDUCATION */}
            {activeTab === 'education' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-cyan-400" /> Academic Background
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    USER_CONFIRMED &bull; Verified
                  </span>
                </div>

                {/* Clear High School Notice */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold block">No University Degree &mdash; Current HSC Student</span>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      Farhan is currently an HSC 2nd Year student (Science) at Pallabi Government College and has not completed university education. Do NOT describe candidate as a Computer Science graduate, university student, or software engineer by degree.
                    </p>
                  </div>
                </div>

                {profile.education.map((edu, idx) => (
                  <div key={edu.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-100 text-sm">{edu.institution}</span>
                        {getProvenanceBadge(edu.provenance, edu.verified)}
                      </div>
                      {getVisibilityBadge(edu.visibility)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Level & Stream</span>
                        <span className="text-slate-100 font-semibold">{edu.level} &bull; Stream: {edu.stream}</span>
                      </div>

                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Expected HSC Completion</span>
                        <span className="text-slate-100 font-semibold">{edu.expectedGraduation}</span>
                      </div>

                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Previous College</span>
                        <span className="text-slate-100 font-semibold">{edu.previousCollege}</span>
                      </div>

                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">SSC Institution & Result</span>
                        <span className="text-slate-100 font-semibold">{edu.sscInstitution} (Year: {edu.sscYear}, GPA: {edu.sscGpa})</span>
                      </div>
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                      {edu.academicHistory}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 3. SKILLS */}
            {activeTab === 'skills' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-cyan-400" /> Categorized Skills & Tech Stack
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    {profile.skills.verifiedSkills.length} USER_CONFIRMED Skills
                  </span>
                </div>

                {/* Clarification banner */}
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs">
                  <span className="font-bold block">Context Distinction</span>
                  <p className="text-[11px] text-cyan-200/80 mt-0.5">
                    Skills listed here represent demonstrated <strong>LEARNING & PROJECT EXPERIENCE</strong> from practical deliverables (Agent HQ, Auren, HSC AI Study System, Atlas, Gym Tracker). No professional commercial software engineering employment claimed.
                  </p>
                </div>

                {/* Categorized Tech Stacks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: 'Programming & Web', items: profile.skills.frontend },
                    { title: 'Backend & Data', items: profile.skills.backend },
                    { title: 'AI & Multi-Agent Systems', items: profile.skills.ai },
                    { title: 'Development Tools & APIs', items: profile.skills.development || [] },
                  ].map((cat, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                      <span className="text-slate-200 font-bold text-xs">{cat.title}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] border border-slate-700"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. VERIFIED PROJECTS */}
            {activeTab === 'projects' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-cyan-400" /> Personal & Student Projects
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    {profile.projects.length} Confirmed Projects
                  </span>
                </div>

                <div className="space-y-4">
                  {profile.projects.map((proj, idx) => (
                    <div key={proj.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-100">{proj.name}</span>
                          <span className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold">
                            {proj.status || 'Personal Project'}
                          </span>
                          {getProvenanceBadge(proj.provenance, proj.verified)}
                        </div>
                        {getVisibilityBadge(proj.visibility)}
                      </div>

                      <p className="text-slate-300 text-xs leading-relaxed">{proj.description}</p>

                      {/* Known Capabilities */}
                      {proj.capabilities && proj.capabilities.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                            Known Capabilities & Architecture
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {proj.capabilities.map((cap, ci) => (
                              <span
                                key={ci}
                                className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 text-[10px] font-medium"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Technologies */}
                      <div className="flex flex-wrap gap-1.5">
                        {proj.technologies.map((t, ti) => (
                          <span key={ti} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-mono">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. WORK EXPERIENCE */}
            {activeTab === 'experience' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-400" /> Work Experience
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    1 Record &bull; USER_CONFIRMED
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs">
                  <span className="font-bold text-slate-200 block">Retail Work Experience</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Operated point-of-sale terminals and customer checkouts at Shwapno. Zero software development duties, engineering metrics, or management claims.
                  </p>
                </div>

                {profile.experience.map((exp, idx) => (
                  <div key={exp.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-100">{exp.role}</h4>
                          {getProvenanceBadge(exp.provenance, exp.verified)}
                        </div>
                        <span className="text-slate-400 text-xs">
                          {exp.organization} &bull; July 30, 2025 &mdash; December 20, 2025
                        </span>
                      </div>
                      {getVisibilityBadge(exp.visibility)}
                    </div>

                    <p className="text-slate-300 text-xs leading-relaxed">{exp.description}</p>

                    {exp.reasonForLeaving && (
                      <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Reason for Leaving:</span>
                        <span className="text-slate-200">{exp.reasonForLeaving}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 6. CERTIFICATIONS & ACHIEVEMENTS */}
            {activeTab === 'certifications' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-cyan-400" /> Certifications & Achievements
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    None Confirmed (Legitimate &apos;None&apos;)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Formal Certifications</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Currently: <strong>None confirmed</strong>. The profile strictly enforces zero-fabrication: courses, tutorials, or technologies are not converted into formal certificates without official verification.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Status: Legitimate None (—)
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Formally Verified Achievements</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Currently: <strong>None confirmed</strong>. Project completion is not converted into formal competition awards or verified institutional honors.
                    </p>
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                      Status: Legitimate None (—)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. SERVICES */}
            {activeTab === 'services' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" /> Services Offered
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    Freelance / Contract Opportunities
                  </span>
                </div>

                {/* Strict distinction notice */}
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs">
                  <span className="font-bold block">Crucial Distinction: Services Offered vs Client History</span>
                  <p className="text-[11px] text-cyan-200/80 mt-0.5">
                    These are services Farhan is interested in offering to clients. They are <strong>SERVICES OFFERED</strong>, NOT claims of previous commercial client work. Do NOT invent prior commercial clients.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {profile.services.otherApprovedServices.map((svc, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5 text-slate-200 font-semibold text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{svc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. LINKS */}
            {activeTab === 'links' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-cyan-400" /> Online Presence & Repositories
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-slate-400 block text-xs font-medium">Portfolio URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={profile.identity.portfolioUrl}
                        readOnly
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs"
                      />
                      <a
                        href={profile.identity.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-slate-400 block text-xs font-medium">GitHub Profile</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={profile.identity.githubUrl}
                        readOnly
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs"
                      />
                      <a
                        href={profile.identity.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. DOCUMENTS / RESUME STUDIO */}
            {activeTab === 'documents' && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Resume Studio (4 Targeted Variants)
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    Grounded Exclusively in USER_CONFIRMED Data
                  </span>
                </div>

                {/* Representation rule banner */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="font-bold block">Authentic Grounding Enforcement</span>
                    <span className="text-[11px] text-emerald-200/80">
                      Candidate represented as: Student / aspiring software developer / AI builder. Zero university degree or professional employment claimed.
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentResume.content);
                      setCopiedResume(true);
                      setTimeout(() => setCopiedResume(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer shadow transition"
                  >
                    {copiedResume ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResume ? 'Copied to Clipboard!' : 'Copy Markdown'}</span>
                  </button>
                </div>

                {/* Variant Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  {[
                    { id: 'master', label: 'Master Resume', target: 'Software Developer & AI Builder' },
                    { id: 'frontend', label: 'Frontend Developer', target: 'Frontend & Web Applications' },
                    { id: 'ai', label: 'AI Developer', target: 'AI Systems & Multi-Agent Builder' },
                    { id: 'internship', label: 'Student Internship', target: 'Software Development / AI Intern' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveVariant(tab.id as ResumeVariant)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        activeVariant === tab.id
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Resume Content Preview */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                    <span className="font-bold text-slate-200">{currentResume.title}</span>
                    <span className="text-slate-400 font-mono text-[10px]">Target: {currentResume.targetRole}</span>
                  </div>
                  <textarea
                    rows={15}
                    value={currentResume.content}
                    readOnly
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs leading-relaxed outline-none"
                  />
                </div>
              </div>
            )}

            {/* 10. PRIVACY */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" /> Granular Privacy & Data Exposure Controls
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                      <Eye className="w-3.5 h-3.5" /> PUBLIC
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Visible on public portfolios, public profiles, and sharable summaries.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                      <Briefcase className="w-3.5 h-3.5" /> APPLICATION ONLY
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Only exposed in tailored resumes or formal application drafts submitted directly to organizations.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-2">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold uppercase tracking-wider text-[11px]">
                      <Lock className="w-3.5 h-3.5" /> PRIVATE
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Strictly internal to Farhan. Never included in generated resumes, applications, or outreach messages.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
