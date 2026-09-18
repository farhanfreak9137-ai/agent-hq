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
  Plus,
  Trash2,
  Edit3,
  Rocket,
  Mail,
  Send,
  EyeOff,
  RefreshCw,
  Clock,
  Key,
  Bell,
  MessageSquare,
} from 'lucide-react';
import {
  ProfessionalProfile,
  ProfileSuggestion,
  ProfileVisibility,
  ResumeVariant,
  ProfileEducation,
  ProfileProject,
  ProfileExperience,
  ProfileCertification,
} from '../types/index.ts';
import { ProfileManager } from '../profile/ProfileManager.ts';
import { ApiClient } from '../services/ApiClient.ts';
import { generateId } from '../utils/id.ts';

interface FarhanProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabSection =
  | 'profile'
  | 'job_preferences'
  | 'email_outreach'
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

  // Quick-add input states
  const [newInterest, setNewInterest] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState<'frontend' | 'backend' | 'ai' | 'development'>('frontend');
  const [newSkillText, setNewSkillText] = useState('');
  const [newServiceText, setNewServiceText] = useState('');
  const [newTargetRole, setNewTargetRole] = useState('');
  const [newDealBreaker, setNewDealBreaker] = useState('');
  const [copiedMasterResume, setCopiedMasterResume] = useState(false);

  // Gmail & Cold Outreach Integration state
  const [emailConfig, setEmailConfig] = useState<{
    gmail_address: string;
    app_password: string;
    sender_name: string;
    stagger_delay_seconds: number;
    auto_send_enabled: number;
    has_password?: boolean;
  }>({
    gmail_address: 'farhan.sajid1896@gmail.com',
    app_password: '',
    sender_name: 'Md Farhan Hossain',
    stagger_delay_seconds: 20,
    auto_send_enabled: 0,
    has_password: false,
  });
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaveSuccess, setEmailSaveSuccess] = useState(false);

  // Discord Phone Notifications state
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [discordSaveSuccess, setDiscordSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setProfile(ProfileManager.getProfile('FULL'));
      setSuggestions(ProfileManager.getSuggestions('PENDING'));
      ApiClient.getInstance()
        .getEmailConfig()
        .then((cfg) => {
          if (cfg) {
            setEmailConfig(cfg);
          }
        })
        .catch(() => {});
      ApiClient.getInstance()
        .getNotificationConfig()
        .then((cfg) => {
          if (cfg) {
            setDiscordWebhookUrl(cfg.discord_webhook_url || '');
            setNotificationsEnabled(Boolean(cfg.is_enabled));
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSaveEmailConfig = async () => {
    setSavingEmail(true);
    try {
      const res = await ApiClient.getInstance().updateEmailConfig(emailConfig);
      if (res?.success && res.config) {
        setEmailConfig(res.config);
        setEmailSaveSuccess(true);
        setTimeout(() => setEmailSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    setEmailTestResult(null);
    try {
      await ApiClient.getInstance().updateEmailConfig(emailConfig);
      const res = await ApiClient.getInstance().testEmailConnection();
      if (res) {
        setEmailTestResult(res);
      } else {
        setEmailTestResult({ success: false, message: 'Could not connect to backend server.' });
      }
    } catch (err: any) {
      setEmailTestResult({ success: false, message: err?.message || 'Connection failed' });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleSaveDiscordConfig = async () => {
    try {
      await ApiClient.getInstance().updateNotificationConfig({
        channel: 'discord',
        discord_webhook_url: discordWebhookUrl,
        is_enabled: notificationsEnabled ? 1 : 0,
      });
      setDiscordSaveSuccess(true);
      setTimeout(() => setDiscordSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    setDiscordTestResult(null);
    try {
      await ApiClient.getInstance().updateNotificationConfig({
        channel: 'discord',
        discord_webhook_url: discordWebhookUrl,
        is_enabled: 1,
      });
      const res = await ApiClient.getInstance().testNotificationAlert();
      if (res) {
        setDiscordTestResult(res);
      } else {
        setDiscordTestResult({ success: false, message: 'Could not send test notification.' });
      }
    } catch (err: any) {
      setDiscordTestResult({ success: false, message: err?.message || 'Failed to send alert' });
    } finally {
      setTestingDiscord(false);
    }
  };

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

  // --- Job Preferences Helpers ---
  const handleAddTargetRole = (roleToAdd?: string) => {
    const role = (roleToAdd || newTargetRole).trim();
    if (!role) return;
    const currentRoles = profile.preferences?.targetRoles || [];
    if (!currentRoles.includes(role)) {
      setProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          targetRoles: [...currentRoles, role],
        },
      });
    }
    setNewTargetRole('');
  };

  const handleRemoveTargetRole = (role: string) => {
    const currentRoles = profile.preferences?.targetRoles || [];
    setProfile({
      ...profile,
      preferences: {
        ...profile.preferences,
        targetRoles: currentRoles.filter((r) => r !== role),
      },
    });
  };

  const handleAddDealBreaker = (itemToAdd?: string) => {
    const item = (itemToAdd || newDealBreaker).trim();
    if (!item) return;
    const currentBreakers = profile.preferences?.dealBreakers || [];
    if (!currentBreakers.includes(item)) {
      setProfile({
        ...profile,
        preferences: {
          ...profile.preferences,
          dealBreakers: [...currentBreakers, item],
        },
      });
    }
    setNewDealBreaker('');
  };

  const handleRemoveDealBreaker = (item: string) => {
    const currentBreakers = profile.preferences?.dealBreakers || [];
    setProfile({
      ...profile,
      preferences: {
        ...profile.preferences,
        dealBreakers: currentBreakers.filter((b) => b !== item),
      },
    });
  };

  // --- Skill Helpers ---
  const handleAddSkill = (cat: 'frontend' | 'backend' | 'ai' | 'development', skill: string) => {
    const trimmed = skill.trim();
    if (!trimmed) return;
    const currentList = profile.skills[cat] || [];
    if (currentList.includes(trimmed)) return;

    const updatedCatList = [...currentList, trimmed];
    const updatedVerified = Array.from(new Set([...(profile.skills.verifiedSkills || []), trimmed]));

    setProfile({
      ...profile,
      skills: {
        ...profile.skills,
        [cat]: updatedCatList,
        verifiedSkills: updatedVerified,
      },
    });
  };

  const handleRemoveSkill = (cat: 'frontend' | 'backend' | 'ai' | 'development', skill: string) => {
    const updatedCatList = (profile.skills[cat] || []).filter((s) => s !== skill);
    const updatedVerified = (profile.skills.verifiedSkills || []).filter((s) => s !== skill);

    setProfile({
      ...profile,
      skills: {
        ...profile.skills,
        [cat]: updatedCatList,
        verifiedSkills: updatedVerified,
      },
    });
  };

  // --- Interest Helpers ---
  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    if (!trimmed) return;
    const current = profile.identity.primaryInterests || [];
    if (!current.includes(trimmed)) {
      setProfile({
        ...profile,
        identity: {
          ...profile.identity,
          primaryInterests: [...current, trimmed],
        },
      });
    }
    setNewInterest('');
  };

  const handleRemoveInterest = (interest: string) => {
    setProfile({
      ...profile,
      identity: {
        ...profile.identity,
        primaryInterests: (profile.identity.primaryInterests || []).filter((i) => i !== interest),
      },
    });
  };

  // --- Service Helpers ---
  const handleAddService = () => {
    const trimmed = newServiceText.trim();
    if (!trimmed) return;
    const current = profile.services.otherApprovedServices || [];
    if (!current.includes(trimmed)) {
      setProfile({
        ...profile,
        services: {
          ...profile.services,
          otherApprovedServices: [...current, trimmed],
        },
      });
    }
    setNewServiceText('');
  };

  const handleRemoveService = (service: string) => {
    setProfile({
      ...profile,
      services: {
        ...profile.services,
        otherApprovedServices: (profile.services.otherApprovedServices || []).filter((s) => s !== service),
      },
    });
  };

  // --- Education Helpers ---
  const handleAddEducation = () => {
    const newEdu: ProfileEducation = {
      id: generateId('edu'),
      institution: 'New Institution',
      program: 'Higher Secondary Certificate (HSC)',
      currentYear: '2nd Year',
      level: 'HSC',
      stream: 'Science',
      expectedGraduation: '2026',
      previousCollege: '',
      sscInstitution: '',
      sscYear: '2023',
      sscGpa: '5.00',
      academicHistory: '',
      provenance: 'USER_CONFIRMED',
      visibility: 'PUBLIC',
      verified: true,
    };
    setProfile({
      ...profile,
      education: [newEdu, ...profile.education],
    });
  };

  const handleUpdateEducation = (idx: number, field: keyof ProfileEducation, val: any) => {
    const updated = [...profile.education];
    updated[idx] = { ...updated[idx], [field]: val };
    setProfile({ ...profile, education: updated });
  };

  const handleRemoveEducation = (idx: number) => {
    setProfile({
      ...profile,
      education: profile.education.filter((_, i) => i !== idx),
    });
  };

  // --- Project Helpers ---
  const handleAddProject = () => {
    const newProj: ProfileProject = {
      id: generateId('proj'),
      name: 'New Project Title',
      role: 'Lead Developer & Architect',
      status: 'Personal Project',
      description: 'Project description and architecture overview.',
      technologies: ['TypeScript', 'React'],
      capabilities: ['Full-Stack', 'UI Design'],
      evidence: [],
      provenance: 'USER_CONFIRMED',
      visibility: 'PUBLIC',
      verified: true,
    };
    setProfile({
      ...profile,
      projects: [newProj, ...profile.projects],
    });
  };

  const handleUpdateProject = (idx: number, field: keyof ProfileProject, val: any) => {
    const updated = [...profile.projects];
    updated[idx] = { ...updated[idx], [field]: val };
    setProfile({ ...profile, projects: updated });
  };

  const handleRemoveProject = (idx: number) => {
    setProfile({
      ...profile,
      projects: profile.projects.filter((_, i) => i !== idx),
    });
  };

  // --- Experience Helpers ---
  const handleAddExperience = () => {
    const newExp: ProfileExperience = {
      id: generateId('exp'),
      role: 'Role Title',
      organization: 'Organization Name',
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      description: 'Responsibilities and tasks performed.',
      reasonForLeaving: '',
      provenance: 'USER_CONFIRMED',
      visibility: 'APPLICATION_ONLY',
      verified: true,
    };
    setProfile({
      ...profile,
      experience: [newExp, ...profile.experience],
    });
  };

  const handleUpdateExperience = (idx: number, field: keyof ProfileExperience, val: any) => {
    const updated = [...profile.experience];
    updated[idx] = { ...updated[idx], [field]: val };
    setProfile({ ...profile, experience: updated });
  };

  const handleRemoveExperience = (idx: number) => {
    setProfile({
      ...profile,
      experience: profile.experience.filter((_, i) => i !== idx),
    });
  };

  // --- Certification Helpers ---
  const handleAddCertification = () => {
    const newCert: ProfileCertification = {
      id: generateId('cert'),
      name: 'Certification Title',
      issuer: 'Issuing Organization',
      issueDate: '2026',
      credentialUrl: '',
      provenance: 'USER_CONFIRMED',
      visibility: 'PUBLIC',
      verified: true,
    };
    setProfile({
      ...profile,
      certifications: [newCert, ...(profile.certifications || [])],
    });
  };

  const handleUpdateCertification = (idx: number, field: keyof ProfileCertification, val: any) => {
    const updated = [...(profile.certifications || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    setProfile({ ...profile, certifications: updated });
  };

  const handleRemoveCertification = (idx: number) => {
    setProfile({
      ...profile,
      certifications: (profile.certifications || []).filter((_, i) => i !== idx),
    });
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
                  EDITABLE AUTHORITATIVE STORE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative source of truth for Farhan. All sections are directly editable and persist to SQLite.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer active:scale-95 ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30'
              }`}
            >
              {saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saveSuccess ? 'Saved to Database' : 'Save Changes'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
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
                  <span>Skills</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Projects</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Experience</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
              </div>
            </div>

            {/* TAB BUTTONS */}
            {[
              { id: 'profile', label: 'Identity & Overview', icon: <User className="w-4 h-4" /> },
              { id: 'job_preferences', label: 'Job & Remote Filters', icon: <Briefcase className="w-4 h-4 text-emerald-400" /> },
              { id: 'email_outreach', label: 'Gmail & Cold Outreach', icon: <Mail className="w-4 h-4 text-rose-400" /> },
              { id: 'education', label: 'Academic & Education', icon: <GraduationCap className="w-4 h-4" /> },
              { id: 'skills', label: 'Skills & Tech Stack', icon: <Wrench className="w-4 h-4" /> },
              { id: 'projects', label: 'Projects & Repos', icon: <FolderGit2 className="w-4 h-4" /> },
              { id: 'experience', label: 'Work Experience', icon: <Briefcase className="w-4 h-4" /> },
              { id: 'certifications', label: 'Certifications', icon: <Award className="w-4 h-4" /> },
              { id: 'services', label: 'Services Offered', icon: <Layers className="w-4 h-4" /> },
              { id: 'links', label: 'Links & Socials', icon: <LinkIcon className="w-4 h-4" /> },
              { id: 'documents', label: 'Tailored Resumes', icon: <FileText className="w-4 h-4" /> },
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
                    <User className="w-4 h-4 text-cyan-400" /> Identity Information (Editable)
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">Authoritative Store</span>
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
                    <label className="text-slate-400 font-medium block mb-1">Professional / Preferred Name</label>
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
                    <label className="text-slate-400 font-medium block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profile.identity.phone || ''}
                      placeholder="+880 1..."
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, phone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">LinkedIn Profile URL</label>
                    <input
                      type="url"
                      value={profile.identity.linkedInUrl || (profile.identity as any).linkedinUrl || ''}
                      placeholder="https://www.linkedin.com/in/..."
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, linkedInUrl: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 font-mono text-xs"
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

                  <div>
                    <label className="text-slate-400 font-medium block mb-1">Primary Timezone</label>
                    <input
                      type="text"
                      value={profile.identity.timezone || ''}
                      placeholder="UTC+6 (Dhaka, Bangladesh)"
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          identity: { ...profile.identity, timezone: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 text-xs"
                    />
                  </div>
                </div>

                {/* Primary Development Interests (Interactive Chips) */}
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                  <span className="text-slate-300 font-bold text-xs uppercase tracking-wider block">
                    Primary Development Interests
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(profile.identity.primaryInterests || []).map((interest, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold"
                      >
                        {interest}
                        <button
                          type="button"
                          onClick={() => handleRemoveInterest(interest)}
                          className="text-cyan-400 hover:text-cyan-100 font-bold"
                          title="Remove interest"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newInterest}
                      placeholder="Add an interest (e.g. Distributed Consensus)..."
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddInterest();
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 w-64"
                    />
                    <button
                      type="button"
                      onClick={handleAddInterest}
                      className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition"
                    >
                      Add Interest
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-medium block mb-1">Professional Bio & Executive Summary</label>
                  <textarea
                    rows={4}
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

            {/* JOB & REMOTE WORK PREFERENCES (BOSS INTEGRATION) */}
            {activeTab === 'job_preferences' && (
              <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
                {/* Header with Agent Sync Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-sm uppercase tracking-wider">
                      <Briefcase className="w-4 h-4" />
                      <span>Job & Remote Work Strategy (Agent Integrated)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-Synced to BOSS
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Configure your live resume, LinkedIn, target roles, minimum pay, timezone requirements, and submission strategy. BOSS, Atlas, Quill, and Strategist consult these parameters directly so they will <strong>never ask you for them repeatedly</strong>.
                  </p>
                </div>

                {/* 1. Core Master Resume */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                        1. Master Resume (Markdown / Text)
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const resumeText =
                            profile.documents?.masterResumeMarkdown ||
                            profile.documents?.resumeVersions?.[0]?.content ||
                            '';
                          navigator.clipboard.writeText(resumeText);
                          setCopiedMasterResume(true);
                          setTimeout(() => setCopiedMasterResume(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer"
                      >
                        {copiedMasterResume ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedMasterResume ? 'Copied!' : 'Copy Resume'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Paste or edit your complete master resume here. When agents draft applications, cover letters, or pitch emails, they will draw directly from this content.
                  </p>
                  <textarea
                    rows={10}
                    value={
                      profile.documents?.masterResumeMarkdown ||
                      profile.documents?.resumeVersions?.[0]?.content ||
                      ''
                    }
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        documents: {
                          ...profile.documents,
                          masterResumeMarkdown: e.target.value,
                        },
                      })
                    }
                    placeholder="Paste your full markdown or text resume here..."
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 font-mono text-[11px] leading-relaxed resize-y"
                  />
                </div>

                {/* 2. Key Coordinates & Contact Details */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      2. Profile Links & Timezone
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">LinkedIn Profile URL</label>
                      <input
                        type="url"
                        value={profile.identity.linkedInUrl || (profile.identity as any).linkedinUrl || ''}
                        placeholder="https://www.linkedin.com/in/..."
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: {
                              ...profile.identity,
                              linkedInUrl: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Phone / WhatsApp Contact</label>
                      <input
                        type="tel"
                        value={profile.identity.phone || ''}
                        placeholder="+880 1XXXXXXXXX"
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: {
                              ...profile.identity,
                              phone: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Portfolio Website</label>
                      <input
                        type="url"
                        value={profile.identity.portfolioUrl || ''}
                        placeholder="https://portfolio..."
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: {
                              ...profile.identity,
                              portfolioUrl: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Location & Primary Timezone</label>
                      <input
                        type="text"
                        value={profile.identity.timezone || profile.identity.location || ''}
                        placeholder="UTC+6 (Dhaka, Bangladesh)"
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: {
                              ...profile.identity,
                              timezone: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Filters & Target Preferences */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      3. Filters, Target Roles & Compensation
                    </h4>
                  </div>

                  {/* Target Roles */}
                  <div className="space-y-2">
                    <label className="text-slate-400 font-medium block text-xs">
                      Target Roles & Job Titles
                    </label>
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg bg-slate-950 border border-slate-800">
                      {(profile.preferences?.targetRoles || []).map((role, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold"
                        >
                          {role}
                          <button
                            type="button"
                            onClick={() => handleRemoveTargetRole(role)}
                            className="hover:text-rose-400 transition cursor-pointer"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTargetRole}
                        placeholder="Add a target role (e.g. AI Engineer, Full Stack Developer)..."
                        onChange={(e) => setNewTargetRole(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTargetRole();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTargetRole()}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Add Role
                      </button>
                    </div>
                    {/* Role suggestions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {['Full Stack Engineer', 'AI Engineer', 'Frontend Developer', 'AI Integrations Specialist', 'Node.js Developer'].map((sug) => {
                        const exists = (profile.preferences?.targetRoles || []).includes(sug);
                        if (exists) return null;
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleAddTargetRole(sug)}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          >
                            + {sug}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pay & Timezone Requirements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">
                        Minimum Pay / Target Compensation
                      </label>
                      <input
                        type="text"
                        value={profile.preferences?.minSalary || ''}
                        placeholder="$45,000 - $75,000 / year (or $30 - $50 / hour)"
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            preferences: {
                              ...profile.preferences,
                              minSalary: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">
                        Timezone Overlap Requirements
                      </label>
                      <input
                        type="text"
                        value={profile.preferences?.timezoneRequirements || ''}
                        placeholder="Flexible — 4+ hours daily overlap with US/EU"
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            preferences: {
                              ...profile.preferences,
                              timezoneRequirements: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
                      />
                    </div>
                  </div>

                  {/* Deal-Breakers */}
                  <div className="space-y-2 pt-2">
                    <label className="text-slate-400 font-medium block text-xs">
                      Deal-Breakers & Strict Exclusions
                    </label>
                    <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-lg bg-slate-950 border border-slate-800">
                      {(profile.preferences?.dealBreakers || []).map((breaker, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-semibold"
                        >
                          {breaker}
                          <button
                            type="button"
                            onClick={() => handleRemoveDealBreaker(breaker)}
                            className="hover:text-white transition cursor-pointer"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newDealBreaker}
                        placeholder="Add a deal-breaker (e.g. No relocation, 100% remote only)..."
                        onChange={(e) => setNewDealBreaker(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddDealBreaker();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddDealBreaker()}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Add Exclusion
                      </button>
                    </div>
                    {/* Deal breaker suggestions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {['No relocation (100% remote only)', 'No uncompensated take-home test projects', 'No unpaid work', 'No on-call rotations'].map((sug) => {
                        const exists = (profile.preferences?.dealBreakers || []).includes(sug);
                        if (exists) return null;
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleAddDealBreaker(sug)}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          >
                            + {sug}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4. Execution & Submission Strategy */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      4. Application Execution Strategy
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            submissionStrategy: 'human_in_the_loop',
                          },
                        })
                      }
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer space-y-1.5 ${
                        (profile.preferences?.submissionStrategy || 'human_in_the_loop') === 'human_in_the_loop'
                          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">Option A: Human-in-the-Loop</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">Recommended</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        We parse jobs, calculate match scores, draft tailored cover letters + pre-filled answers. You review and approve each application before dispatch.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            submissionStrategy: 'autonomous',
                          },
                        })
                      }
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer space-y-1.5 ${
                        profile.preferences?.submissionStrategy === 'autonomous'
                          ? 'bg-purple-500/15 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">Option B: Autonomous Submission</span>
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[9px] font-bold">Hands-Free</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        For jobs with direct email applications or standard forms, execution agents automatically submit verified applications directly on your behalf.
                      </p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GMAIL & COLD OUTREACH INTEGRATION */}
            {activeTab === 'email_outreach' && (
              <div className="space-y-5 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                      <Mail className="w-4 h-4 text-rose-400" /> Gmail Integration & Cold Outreach Engine
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Empower agents (Outreach & BOSS) to pitch and send job applications directly through your personal Gmail.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {emailConfig.has_password ? (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Gmail Authenticated
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" /> App Password Needed
                      </span>
                    )}
                  </div>
                </div>

                {/* Guide Box */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-semibold text-xs">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    How to connect your personal Gmail (Takes 1 minute):
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1 pl-1">
                    <li>
                      Ensure 2-Step Verification is ON in your Google account:{" "}
                      <a
                        href="https://myaccount.google.com/signinoptions/two-step-verification"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline inline-flex items-center gap-1"
                      >
                        Google Security <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </li>
                    <li>
                      Generate a 16-character App Password:{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 underline inline-flex items-center gap-1"
                      >
                        myaccount.google.com/apppasswords <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </li>
                    <li>Enter name as <strong>Agent HQ</strong>, click Create, and paste the 16-character code below.</li>
                  </ol>
                </div>

                {/* Credential Fields */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Key className="w-4 h-4 text-rose-400" /> Gmail SMTP Credentials
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Sender Display Name</label>
                      <input
                        type="text"
                        value={emailConfig.sender_name}
                        placeholder="Md Farhan Hossain"
                        onChange={(e) => setEmailConfig({ ...emailConfig, sender_name: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 text-xs font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Your Gmail Address</label>
                      <input
                        type="email"
                        value={emailConfig.gmail_address}
                        placeholder="farhan.sajid1896@gmail.com"
                        onChange={(e) => setEmailConfig({ ...emailConfig, gmail_address: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-medium block mb-1 text-xs flex items-center justify-between">
                      <span>16-Character Google App Password</span>
                      <span className="text-[10px] text-slate-500">Spaces are stripped automatically</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showAppPassword ? 'text' : 'password'}
                        value={emailConfig.app_password}
                        placeholder={emailConfig.has_password ? '•••••••••••••••• (Configured)' : 'e.g. abcd efgh ijkl mnop'}
                        onChange={(e) => setEmailConfig({ ...emailConfig, app_password: e.target.value })}
                        className="w-full pl-3 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-rose-500 outline-none text-slate-100 text-xs font-mono tracking-wider"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppPassword(!showAppPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                      >
                        {showAppPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Safeguards & Throttling */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" /> Anti-Spam Safeguards & Delivery Pacing
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-400 font-medium block mb-1 text-xs">
                        Stagger Delay Between Outgoing Emails (Seconds)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="120"
                        value={emailConfig.stagger_delay_seconds}
                        onChange={(e) => setEmailConfig({ ...emailConfig, stagger_delay_seconds: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-cyan-500 outline-none text-slate-100 text-xs font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Recommended: 20s. Keeps your personal account 100% compliant with Google sending policies.
                      </p>
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="text-slate-400 font-medium block mb-1 text-xs">Direct Dispatch Mode</label>
                      <button
                        type="button"
                        onClick={() =>
                          setEmailConfig({
                            ...emailConfig,
                            auto_send_enabled: emailConfig.auto_send_enabled ? 0 : 1,
                          })
                        }
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition cursor-pointer ${
                          emailConfig.auto_send_enabled
                            ? 'bg-purple-500/15 border-purple-500 text-purple-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="text-xs">
                          <span className="font-semibold block text-slate-200">
                            {emailConfig.auto_send_enabled ? 'Auto-Send Active' : 'Staged Review (Outbox)'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {emailConfig.auto_send_enabled
                              ? 'Agents dispatch directly without staging.'
                              : 'Agents draft into Outbox for 1-click approval.'}
                          </span>
                        </div>
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${
                            emailConfig.auto_send_enabled ? 'bg-purple-400 ring-4 ring-purple-500/20' : 'bg-slate-700'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* DISCORD PHONE ALERTS */}
                <div className="p-4 rounded-xl bg-slate-900/80 border border-indigo-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-400" /> Instant Phone Alerts (Discord Webhook)
                    </h4>
                    <span className="text-[11px] text-indigo-300 font-mono flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Push to Mobile
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When a company or recruiter replies to your job application, receive an instant push notification on your phone via Discord with the recruiter's message and the agent's drafted reply.
                  </p>

                  <div className="space-y-2">
                    <label className="text-slate-400 font-medium block text-xs">Discord Webhook URL</label>
                    <input
                      type="url"
                      value={discordWebhookUrl}
                      placeholder="https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz"
                      onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 outline-none text-slate-100 text-xs font-mono"
                    />
                    <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] text-slate-400 space-y-1">
                      <span className="font-semibold text-indigo-300 block">How to get your Discord Webhook in 10 seconds:</span>
                      <p>Open Discord on PC or browser ➔ Right-click any text channel (e.g. <code>#alerts</code>) ➔ <strong>Edit Channel</strong> ➔ <strong>Integrations</strong> ➔ <strong>Webhooks</strong> ➔ <strong>New Webhook</strong> ➔ Click <strong>Copy Webhook URL</strong> and paste it here.</p>
                    </div>
                  </div>

                  {/* Discord Test Banner */}
                  {discordTestResult && (
                    <div
                      className={`p-3 rounded-lg border flex items-start gap-2 text-xs ${
                        discordTestResult.success
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      {discordTestResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <span className="font-bold block">
                          {discordTestResult.success ? 'Discord Alert Succeeded!' : 'Discord Alert Failed'}
                        </span>
                        <p className="mt-0.5 opacity-90">{discordTestResult.message}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleTestDiscord}
                      disabled={testingDiscord || !discordWebhookUrl}
                      className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                    >
                      {testingDiscord ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      <span>Send Test Alert to My Phone</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {discordSaveSuccess && (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Saved
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveDiscordConfig}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                      >
                        Save Discord URL
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Connection Test Banner */}
                {emailTestResult && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-200 ${
                      emailTestResult.success
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    {emailTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="font-bold block">
                        {emailTestResult.success ? 'Verification Succeeded' : 'Verification Failed'}
                      </span>
                      <p className="mt-0.5 opacity-90 leading-relaxed">{emailTestResult.message}</p>
                    </div>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                  >
                    {testingEmail ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        <span>Verifying & Sending Test...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Send Test Email to Myself</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    {emailSaveSuccess && (
                      <span className="text-emerald-400 text-xs font-medium flex items-center gap-1.5 animate-in fade-in">
                        <Check className="w-3.5 h-3.5" /> Email Settings Saved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveEmailConfig}
                      disabled={savingEmail}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                    >
                      {savingEmail ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Email Settings</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. EDUCATION */}
            {activeTab === 'education' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Academic Background
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Education</span>
                  </button>
                </div>

                {profile.education.map((edu, idx) => (
                  <div key={edu.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">Education Entry #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEducation(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Institution</label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => handleUpdateEducation(idx, 'institution', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Level & Stream</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={edu.level}
                            placeholder="Level (e.g. HSC)"
                            onChange={(e) => handleUpdateEducation(idx, 'level', e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                          />
                          <input
                            type="text"
                            value={edu.stream}
                            placeholder="Stream (e.g. Science)"
                            onChange={(e) => handleUpdateEducation(idx, 'stream', e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Expected Completion</label>
                        <input
                          type="text"
                          value={edu.expectedGraduation}
                          onChange={(e) => handleUpdateEducation(idx, 'expectedGraduation', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Previous College</label>
                        <input
                          type="text"
                          value={edu.previousCollege || ''}
                          onChange={(e) => handleUpdateEducation(idx, 'previousCollege', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">SSC Institution</label>
                        <input
                          type="text"
                          value={edu.sscInstitution || ''}
                          onChange={(e) => handleUpdateEducation(idx, 'sscInstitution', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">SSC Year & GPA</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={edu.sscYear || ''}
                            placeholder="Year"
                            onChange={(e) => handleUpdateEducation(idx, 'sscYear', e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                          />
                          <input
                            type="text"
                            value={edu.sscGpa || ''}
                            placeholder="GPA"
                            onChange={(e) => handleUpdateEducation(idx, 'sscGpa', e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Academic Notes & Context</label>
                      <textarea
                        rows={2}
                        value={edu.academicHistory || ''}
                        onChange={(e) => handleUpdateEducation(idx, 'academicHistory', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. SKILLS */}
            {activeTab === 'skills' && (
              <div className="space-y-5 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-cyan-400" /> Categorized Skills & Tech Stack
                  </h3>
                  <span className="text-[11px] text-teal-400 font-mono">
                    {profile.skills.verifiedSkills.length} Total Verified Skills
                  </span>
                </div>

                {/* Quick Add Skill Form */}
                <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/30 flex flex-wrap items-center gap-3">
                  <span className="font-bold text-xs text-white">Add New Skill:</span>
                  <select
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value as any)}
                    className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="frontend">Programming & Web</option>
                    <option value="backend">Backend & Data</option>
                    <option value="ai">AI & Multi-Agent</option>
                    <option value="development">Dev Tools & APIs</option>
                  </select>
                  <input
                    type="text"
                    value={newSkillText}
                    placeholder="Skill name (e.g. Rust, PyTorch)..."
                    onChange={(e) => setNewSkillText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill(newSkillCategory, newSkillText);
                        setNewSkillText('');
                      }
                    }}
                    className="px-3 py-1 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500 w-52"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleAddSkill(newSkillCategory, newSkillText);
                      setNewSkillText('');
                    }}
                    className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {/* Categorized Tech Stacks with Remove Action */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'frontend' as const, title: 'Programming & Web', items: profile.skills.frontend },
                    { key: 'backend' as const, title: 'Backend & Data', items: profile.skills.backend },
                    { key: 'ai' as const, title: 'AI & Multi-Agent Systems', items: profile.skills.ai },
                    { key: 'development' as const, title: 'Development Tools & APIs', items: profile.skills.development || [] },
                  ].map((cat) => (
                    <div key={cat.key} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-bold text-xs">{cat.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({cat.items.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-slate-200 text-[11px] border border-slate-700 group hover:border-slate-600"
                          >
                            <span>{item}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(cat.key, item)}
                              className="text-slate-400 hover:text-rose-400 font-bold text-xs ml-0.5"
                              title="Delete skill"
                            >
                              &times;
                            </button>
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
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Personal & Student Projects
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Project</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {profile.projects.map((proj, idx) => (
                    <div key={proj.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 text-xs">Project #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProject(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Project
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Project Name</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={(e) => handleUpdateProject(idx, 'name', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 font-bold focus:border-cyan-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Status / Badge</label>
                          <input
                            type="text"
                            value={proj.status || ''}
                            placeholder="e.g. Lead Autonomous Systems Architect"
                            onChange={(e) => handleUpdateProject(idx, 'status', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-cyan-300 focus:border-cyan-500 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Description</label>
                          <textarea
                            rows={2}
                            value={proj.description}
                            onChange={(e) => handleUpdateProject(idx, 'description', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none leading-relaxed"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Technologies (comma separated)</label>
                          <input
                            type="text"
                            value={(proj.technologies || []).join(', ')}
                            onChange={(e) =>
                              handleUpdateProject(
                                idx,
                                'technologies',
                                e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono focus:border-cyan-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Capabilities (comma separated)</label>
                          <input
                            type="text"
                            value={(proj.capabilities || []).join(', ')}
                            onChange={(e) =>
                              handleUpdateProject(
                                idx,
                                'capabilities',
                                e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                              )
                            }
                            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-300 focus:border-cyan-500 outline-none"
                          />
                        </div>
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
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Work Experience
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExperience}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Experience</span>
                  </button>
                </div>

                {profile.experience.map((exp, idx) => (
                  <div key={exp.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-xs">Experience Entry #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExperience(idx)}
                        className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Role / Job Title</label>
                        <input
                          type="text"
                          value={exp.role}
                          onChange={(e) => handleUpdateExperience(idx, 'role', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 font-semibold focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Company / Organization</label>
                        <input
                          type="text"
                          value={exp.organization}
                          onChange={(e) => handleUpdateExperience(idx, 'organization', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Description</label>
                        <textarea
                          rows={2}
                          value={exp.description}
                          onChange={(e) => handleUpdateExperience(idx, 'description', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none leading-relaxed"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Reason for Leaving</label>
                        <input
                          type="text"
                          value={exp.reasonForLeaving || ''}
                          onChange={(e) => handleUpdateExperience(idx, 'reasonForLeaving', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. CERTIFICATIONS & ACHIEVEMENTS */}
            {activeTab === 'certifications' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                      Certifications & Formal Achievements
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCertification}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Certification</span>
                  </button>
                </div>

                {(!profile.certifications || profile.certifications.length === 0) ? (
                  <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                    <Award className="w-8 h-8 text-slate-600 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-300">No Certifications Recorded</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Click the &ldquo;Add Certification&rdquo; button above to record any formal degrees, accredited course completions, or verified awards.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {profile.certifications.map((cert, idx) => (
                      <div key={cert.id || idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 text-xs">Certification #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCertification(idx)}
                            className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Certification Name</label>
                            <input
                              type="text"
                              value={cert.name}
                              onChange={(e) => handleUpdateCertification(idx, 'name', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-100 font-semibold focus:border-cyan-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Issuer / Organization</label>
                            <input
                              type="text"
                              value={cert.issuer}
                              onChange={(e) => handleUpdateCertification(idx, 'issuer', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Issue Date</label>
                            <input
                              type="text"
                              value={cert.issueDate || ''}
                              placeholder="e.g. 2026"
                              onChange={(e) => handleUpdateCertification(idx, 'issueDate', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Credential URL</label>
                            <input
                              type="url"
                              value={cert.credentialUrl || ''}
                              placeholder="https://..."
                              onChange={(e) => handleUpdateCertification(idx, 'credentialUrl', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:border-cyan-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    Freelance & Contract Capabilities
                  </span>
                </div>

                {/* Add Service Input */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                  <input
                    type="text"
                    value={newServiceText}
                    placeholder="Add a new service offered (e.g. Multi-Agent Workflow Engineering)..."
                    onChange={(e) => setNewServiceText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddService();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition"
                  >
                    Add Service
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(profile.services.otherApprovedServices || []).map((svc, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2.5 text-slate-200 font-semibold text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{svc}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(svc)}
                        className="text-slate-400 hover:text-rose-400 font-bold text-sm px-1"
                        title="Delete service"
                      >
                        &times;
                      </button>
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

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-slate-400 block text-xs font-medium">Portfolio URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={profile.identity.portfolioUrl || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: { ...profile.identity, portfolioUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:border-cyan-500 outline-none"
                      />
                      {profile.identity.portfolioUrl && (
                        <a
                          href={profile.identity.portfolioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-slate-400 block text-xs font-medium">GitHub Profile URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={profile.identity.githubUrl || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: { ...profile.identity, githubUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:border-cyan-500 outline-none"
                      />
                      {profile.identity.githubUrl && (
                        <a
                          href={profile.identity.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-slate-400 block text-xs font-medium">LinkedIn Profile URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={profile.identity.linkedinUrl || ''}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            identity: { ...profile.identity, linkedinUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs focus:border-cyan-500 outline-none"
                      />
                      {profile.identity.linkedinUrl && (
                        <a
                          href={profile.identity.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 9. DOCUMENTS / TAILORED RESUMES */}
            {activeTab === 'documents' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" /> Auto-Generated Tailored Resumes
                  </h3>
                  <div className="flex items-center gap-2">
                    {(['master', 'swe_intern', 'fullstack', 'applied_ai'] as ResumeVariant[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setActiveVariant(v)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition ${
                          activeVariant === v
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {v.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
                    <span className="font-bold text-slate-200 text-xs">
                      {activeVariant.toUpperCase()} RESUME PREVIEW
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentResume.content);
                        setCopiedResume(true);
                        setTimeout(() => setCopiedResume(false), 2000);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedResume ? 'Copied Markdown!' : 'Copy Markdown'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                    {currentResume.content}
                  </pre>
                </div>
              </div>
            )}

            {/* 10. PRIVACY CONTROLS */}
            {activeTab === 'privacy' && (
              <div className="space-y-4 max-w-3xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" /> Privacy & Scope Filtering
                  </h3>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-200 text-xs">Three-Tier Visibility Controls</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Agent HQ enforces field-level visibility filtering across all three data scopes:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-1">
                      <span className="font-bold text-emerald-400 block">PUBLIC</span>
                      <p className="text-[11px] text-slate-400">
                        Visible on portfolio websites, external public profiles, and overview views.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/30 space-y-1">
                      <span className="font-bold text-amber-400 block">APPLICATION ONLY</span>
                      <p className="text-[11px] text-slate-400">
                        Restricted to tailored job and internship application submissions.
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-purple-500/30 space-y-1">
                      <span className="font-bold text-purple-400 block">PRIVATE</span>
                      <p className="text-[11px] text-slate-400">
                        Confidential operator-only data; never shared externally or with candidate matching.
                      </p>
                    </div>
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
