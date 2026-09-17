import {
  ProfessionalProfile,
  ProfileSuggestion,
  ProfileVisibility,
  ResumeVariant,
  ProfileCompleteness,
} from '../types/index.ts';
import { EventBus } from '../events/EventBus.ts';
import { generateId } from '../utils/id.ts';

const PROFILE_STORAGE_KEY = 'agent_hq_farhan_profile';
const SUGGESTIONS_STORAGE_KEY = 'agent_hq_profile_suggestions';

export const INITIAL_FARHAN_PROFILE: ProfessionalProfile = {
  id: 'farhan_profile_master',
  identity: {
    fullName: 'Md Farhan Hossain',
    professionalName: 'Farhan',
    professionalHeadline: 'Software Developer & AI Builder',
    email: 'farhanfreak9137@gmail.com',
    location: 'Dhaka, Bangladesh',
    portfolioUrl: 'https://portfolio-two-chi-dgvbedq05m.vercel.app/',
    githubUrl: 'https://github.com/farhanfreak9137-ai',
    primaryInterests: [
      'AI Engineering',
      'Software Development',
      'Web Development',
      'AI-powered applications',
      'Multi-agent systems',
      'Cloud technologies',
    ],
    bio: 'Software developer and AI builder. Focused on AI engineering, multi-agent systems, and responsive web applications.',
    visibility: {
      fullName: 'PUBLIC',
      professionalName: 'PUBLIC',
      professionalHeadline: 'PUBLIC',
      email: 'APPLICATION_ONLY',
      location: 'PUBLIC',
      portfolioUrl: 'PUBLIC',
      githubUrl: 'PUBLIC',
      bio: 'PUBLIC',
      primaryInterests: 'PUBLIC',
    },
    provenance: 'USER_CONFIRMED',
  },
  education: [
    {
      id: 'edu_pallabi_college',
      institution: 'Pallabi Government College',
      level: 'HSC 2nd Year',
      stream: 'Science',
      program: 'Higher Secondary Certificate (HSC) - Science',
      currentYear: 'HSC 2nd Year',
      expectedGraduation: '2027',
      college: 'Pallabi Government College',
      previousCollege: 'Milestone College',
      hscStatus: 'In Progress (Expected 2027)',
      sscInstitution: 'Mdc Model School and College',
      sscYear: '2025',
      sscGpa: '4.11',
      sscInformation: 'SSC completed in 2025 at Mdc Model School and College with GPA 4.11',
      academicHistory: 'Currently studying in HSC 2nd Year (Science) at Pallabi Government College, expected completion 2027. Previously attended Milestone College. Completed SSC at Mdc Model School and College in 2025 (GPA: 4.11).',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
  ],
  skills: {
    frontend: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vite', 'Tailwind CSS'],
    backend: ['Node.js', 'SQLite'],
    ai: [
      'AI Integration',
      'Generative AI',
      'RAG',
      'Multi-Agent Systems',
      'AI Application Development',
      'AI Tool/Agent Orchestration',
    ],
    cloud: ['Netlify', 'Vercel', 'Git', 'GitHub'],
    databases: ['SQLite'],
    tools: ['Git', 'GitHub', 'VS Code', 'Vite'],
    languages: ['TypeScript', 'JavaScript', 'HTML', 'CSS', 'SQL'],
    development: ['Git', 'GitHub', 'REST API integration', 'Frontend development'],
    verifiedSkills: [
      'HTML',
      'CSS',
      'JavaScript',
      'TypeScript',
      'React',
      'Next.js',
      'Vite',
      'Tailwind CSS',
      'Node.js',
      'SQLite',
      'AI Integration',
      'Generative AI',
      'RAG',
      'Multi-Agent Systems',
      'AI Application Development',
      'AI Tool/Agent Orchestration',
      'Git',
      'GitHub',
      'REST API integration',
      'Frontend development',
    ],
    skillContext: {
      HTML: 'LEARNING',
      CSS: 'LEARNING',
      JavaScript: 'PROJECT_EXPERIENCE',
      TypeScript: 'PROJECT_EXPERIENCE',
      React: 'PROJECT_EXPERIENCE',
      'Next.js': 'PROJECT_EXPERIENCE',
      Vite: 'PROJECT_EXPERIENCE',
      'Tailwind CSS': 'PROJECT_EXPERIENCE',
      'Node.js': 'PROJECT_EXPERIENCE',
      SQLite: 'PROJECT_EXPERIENCE',
      'AI Integration': 'PROJECT_EXPERIENCE',
      'Generative AI': 'PROJECT_EXPERIENCE',
      RAG: 'PROJECT_EXPERIENCE',
      'Multi-Agent Systems': 'PROJECT_EXPERIENCE',
      'AI Application Development': 'PROJECT_EXPERIENCE',
      'AI Tool/Agent Orchestration': 'PROJECT_EXPERIENCE',
      Git: 'PROJECT_EXPERIENCE',
      GitHub: 'PROJECT_EXPERIENCE',
      'REST API integration': 'PROJECT_EXPERIENCE',
      'Frontend development': 'PROJECT_EXPERIENCE',
    },
    visibility: {
      frontend: 'PUBLIC',
      backend: 'PUBLIC',
      ai: 'PUBLIC',
      cloud: 'PUBLIC',
      databases: 'PUBLIC',
      tools: 'PUBLIC',
      languages: 'PUBLIC',
      development: 'PUBLIC',
      verifiedSkills: 'PUBLIC',
    },
    provenance: 'USER_CONFIRMED',
  },
  projects: [
    {
      id: 'proj_agent_hq',
      name: 'Agent HQ',
      status: 'Active project',
      projectType: 'personal',
      role: 'Creator & Architect',
      description: 'A multi-agent orchestration and operations platform.',
      technologies: ['TypeScript', 'React', 'Node.js', 'SQLite', 'Tailwind CSS', 'Vite', 'Git'],
      capabilities: [
        'Multi-agent orchestration',
        'DAG workflows',
        'Agent registry',
        'Tasks',
        'Memory',
        'Artifacts',
        'Tools',
        'EventBus',
        'Telemetry',
        'Retries',
        'Cancellation',
        'Backpressure',
        'Provider routing/fallback',
        'Persistence',
        'Authentication/RBAC',
        'CRM',
        'Outreach drafting',
        'Opportunity research/matching',
        'Human approval workflows',
      ],
      evidence: ['Personal project demonstrating multi-agent orchestration and platform capabilities in Agent HQ codebase'],
      url: 'https://github.com/farhanfreak9137-ai/agent-hq',
      githubUrl: 'https://github.com/farhanfreak9137-ai/agent-hq',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
    {
      id: 'proj_auren',
      name: 'Auren',
      status: 'Active personal project',
      projectType: 'personal',
      role: 'Creator',
      description: 'A Windows-focused AI assistant / cognitive OS project.',
      technologies: [
        'Local AI',
        'AI routing',
        'Tool intent',
        'Memory',
        'Cloud delegation',
        'Voice interaction',
        'Local CPU inference',
        'Cloud AI integration',
      ],
      capabilities: [
        'Local AI',
        'AI routing',
        'Tool intent',
        'Memory',
        'Cloud delegation',
        'Voice interaction',
        'Local CPU inference',
        'Cloud AI integration',
      ],
      evidence: ['Active personal project exploring Windows-focused local and cloud AI integration'],
      url: '',
      githubUrl: '',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
    {
      id: 'proj_hsc_ai',
      name: 'HSC AI Study Intelligence System',
      status: 'Active personal/student project',
      projectType: 'student',
      role: 'Creator & Developer',
      description: 'An AI-powered study system designed around Bangladesh HSC Science education.',
      technologies: [
        'React',
        'TypeScript',
        'Vite',
        'Tailwind CSS',
        'Zustand',
        'KaTeX',
        'Gemini',
        'OpenRouter',
        'Playwright',
        'Capacitor',
      ],
      capabilities: [
        'HSC Science study assistance',
        'RAG',
        'AI question answering',
        'Study workflows',
      ],
      evidence: ['Active personal/student project assisting HSC Science study workflows with AI'],
      url: '',
      githubUrl: '',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
    {
      id: 'proj_atlas',
      name: 'Atlas',
      status: 'Personal project',
      projectType: 'personal',
      role: 'Creator',
      description: 'A productivity application.',
      technologies: ['Next.js', 'React', 'Netlify', 'Android APK'],
      capabilities: ['Tasks', 'Habits', 'Goals', 'Calendar', 'Notes'],
      evidence: ['Personal productivity application with Netlify deployment and Android APK target'],
      url: '',
      githubUrl: '',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
    {
      id: 'proj_gym_tracker',
      name: 'Gym Tracker',
      status: 'Personal project',
      projectType: 'personal',
      role: 'Creator',
      description: 'A fitness tracking application.',
      technologies: ['React', 'TypeScript'],
      capabilities: ['Fitness tracking'],
      evidence: ['Personal fitness tracking application'],
      url: '',
      githubUrl: '',
      visibility: 'PUBLIC',
      verified: true,
      provenance: 'USER_CONFIRMED',
    },
  ],
  experience: [
    {
      id: 'exp_shwapno',
      organization: 'Shwapno',
      role: 'Checkout Assistant / POS Cashier',
      startDate: '2025-07-30',
      endDate: '2025-12-20',
      description: 'Checkout Assistant / POS Cashier at Shwapno. Operated point-of-sale (POS) terminal, managed customer checkouts and transactions. Stepped down to focus more on academic improvement.',
      reasonForLeaving: 'Wanted to focus more on academic improvement.',
      verified: true,
      visibility: 'PUBLIC',
      provenance: 'USER_CONFIRMED',
    },
  ],
  certifications: [],
  achievements: [],
  services: {
    webDevelopment: true,
    frontendDevelopment: true,
    AIIntegration: true,
    automation: true,
    otherApprovedServices: [
      'React website development',
      'Next.js website development',
      'Frontend development',
      'AI integration into web applications',
      'AI-powered web applications',
      'AI agent / automation development',
    ],
    visibility: {
      webDevelopment: 'PUBLIC',
      frontendDevelopment: 'PUBLIC',
      AIIntegration: 'PUBLIC',
      automation: 'PUBLIC',
      otherApprovedServices: 'PUBLIC',
    },
    provenance: 'USER_CONFIRMED',
  },
  preferences: {
    targetOpportunityTypes: ['internship', 'job', 'freelance', 'hackathon', 'open_source', 'collaboration'],
    targetIndustries: ['AI / Machine Learning', 'Developer Tools', 'Software Infrastructure', 'Cloud / Web Systems'],
    targetLocations: ['Remote', 'Dhaka', 'Global Hybrid'],
    remotePreference: 'remote_only',
    visibility: 'APPLICATION_ONLY',
  },
  documents: {
    resumeVersions: [
      {
        id: 'res_master',
        name: 'Master Resume',
        targetRole: 'Student / Aspiring Software Developer & AI Builder',
        content: `# Md Farhan Hossain (Farhan)
Software Developer & AI Builder
Email: farhanfreak9137@gmail.com | Location: Dhaka, Bangladesh
GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/

---
### Summary
Student and aspiring software developer with verified personal and student project experience in modern web development, multi-agent systems, and AI integration. Active builder of full-stack TypeScript/React tools and AI applications.

---
### Education
- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027
- **Milestone College** — Higher Secondary Education (Previous College)
- **Mdc Model School and College** — Secondary School Certificate (SSC), 2025 (GPA: 4.11)
*(Note: High school student; has not completed university education).*

---
### Work Experience
- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)
  - Operated point-of-sale (POS) terminals and managed retail transactions.
  - Stepped down to focus on academic improvement.

---
### Personal & Student Projects
- **Agent HQ** (Active Project)
  - Multi-agent orchestration and operations platform built with TypeScript, React, Node.js, SQLite, Tailwind CSS, and Vite.
  - Engineered DAG task workflows, agent registry, memory, artifacts, and human approval gates.
- **Auren** (Active Personal Project)
  - Windows-focused AI assistant and cognitive OS exploring local AI, tool intent, memory, and voice interaction.
- **HSC AI Study Intelligence System** (Active Student Project)
  - AI-powered study assistance designed for Bangladesh HSC Science curriculum using React, TypeScript, Gemini, RAG, and KaTeX.
- **Atlas** (Personal Project)
  - Productivity application managing tasks, habits, and goals built with Next.js and deployed to Netlify with Android APK target.
- **Gym Tracker** (Personal Project)
  - Fitness tracking application built with React and TypeScript.

---
### Verified Skills (Demonstrated through Projects & Learning)
- **Programming / Web:** HTML, CSS, JavaScript, TypeScript, React, Next.js, Vite, Tailwind CSS
- **Backend / Data:** Node.js, SQLite
- **AI & Systems:** AI Integration, Generative AI, RAG, Multi-Agent Systems, AI Tool/Agent Orchestration
- **Development Tools:** Git, GitHub, REST API integration, Frontend development

---
### Services Offered (Freelance / Contract Opportunities)
- React & Next.js website development
- Frontend web development
- AI integration into web applications
- AI agent and workflow automation`,
        updatedAt: Date.now(),
      },
      {
        id: 'res_frontend',
        name: 'Frontend Developer Resume',
        targetRole: 'Frontend Developer / Web Applications',
        content: `# Md Farhan Hossain (Farhan)
Frontend Developer & Web Builder
Email: farhanfreak9137@gmail.com | GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/

---
### Profile
Student and aspiring frontend developer proficient in React, Next.js, TypeScript, and modern CSS/Tailwind. Demonstrated project experience building responsive user interfaces, dashboard systems, and interactive client applications.

---
### Education
- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027
- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)

---
### Work Experience
- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)
  - Managed point-of-sale customer checkouts and retail transactions. Stepped down to focus on academic improvement.

---
### Key Frontend Projects
- **Agent HQ UI** — Built responsive 2D canvas workspace and telemetry dashboards with React, TypeScript, and Tailwind CSS.
- **Atlas** — Personal productivity application with responsive UI built with Next.js and React.
- **HSC AI Study Interface** — Interactive educational application with KaTeX mathematical rendering and mobile UI via Capacitor.
- **Gym Tracker** — Fitness logging user interface built with React and TypeScript.

---
### Verified Frontend Skills
- React, Next.js, TypeScript, JavaScript, HTML5, CSS3, Tailwind CSS, Vite, REST API integration, Git/GitHub.`,
        updatedAt: Date.now(),
      },
      {
        id: 'res_ai',
        name: 'AI Developer Resume',
        targetRole: 'AI Application & Multi-Agent Builder',
        content: `# Md Farhan Hossain (Farhan)
AI Application Developer & Multi-Agent Builder
Email: farhanfreak9137@gmail.com | GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/

---
### Profile
Aspiring developer specializing in practical AI integration, multi-agent systems, and generative AI applications. Demonstrated project experience building autonomous orchestration workflows and educational RAG pipelines.

---
### Education
- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027
- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)

---
### Work Experience
- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)
  - Managed point-of-sale customer checkouts and transactions. Stepped down to focus on academic improvement.

---
### Featured AI Projects
- **Agent HQ** — Multi-agent orchestration engine with DAG hierarchical task execution, tool use, memory, and provider fallback.
- **Auren** — Windows-focused AI assistant exploring local AI inference, cognitive memory, tool intent, and voice interaction.
- **HSC AI Study Intelligence System** — AI-assisted study workflows with RAG question answering for HSC Science curriculum.

---
### Verified AI & Systems Skills
- Multi-Agent Systems, AI Tool Orchestration, RAG, Generative AI, AI Integration, TypeScript, Node.js, SQLite, Gemini API.`,
        updatedAt: Date.now(),
      },
      {
        id: 'res_internship',
        name: 'Student Internship Resume',
        targetRole: 'Software Development / AI Intern',
        content: `# Md Farhan Hossain (Farhan)
HSC Science Student & Aspiring Software Developer
Email: farhanfreak9137@gmail.com | Location: Dhaka, Bangladesh
GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/

---
### Objective
Enthusiastic HSC 2nd Year Science student seeking a software development or AI engineering internship to apply practical skills in TypeScript, React, Node.js, and autonomous agent systems to real-world software teams.

---
### Academic Background
- **Pallabi Government College** — HSC 2nd Year (Science stream), Expected 2027
- **Milestone College** — Higher Secondary Education
- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)

---
### Work Experience
- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)
  - Demonstrated punctuality, cash-handling accuracy, customer service, and team coordination.

---
### Demonstrated Project Experience
- **Agent HQ** — Multi-agent operations platform built with TypeScript, React, and Node.js.
- **HSC AI Study System** — AI-assisted study system using React, TypeScript, and RAG.
- **Atlas & Gym Tracker** — Personal productivity and utility web applications.

---
### Verified Skills
- TypeScript, JavaScript, React, Next.js, Node.js, SQLite, HTML/CSS, Tailwind CSS, Git, GitHub, REST APIs, AI Integration.`,
        updatedAt: Date.now(),
      },
    ],
    coverLetterTemplates: [
      {
        id: 'cov_student_intern',
        name: 'Student Internship Application Letter',
        template: `Dear Hiring Team,\n\nI am writing to apply for the internship opportunity at your organization.\n\nI am currently an HSC 2nd Year Science student at Pallabi Government College with a strong passion for software engineering and AI systems. Through personal and student projects—such as building Agent HQ (a TypeScript/React multi-agent platform) and the HSC AI Study System—I have developed hands-on technical skills in full-stack development, modern web APIs, and practical AI integration.\n\nIn addition to my technical curiosity, my previous experience as a Checkout Assistant at Shwapno helped me cultivate reliability, attention to detail, and a disciplined work ethic. I am eager to learn, contribute, and collaborate with your team.\n\nSincerely,\nMd Farhan Hossain (Farhan)`,
        updatedAt: Date.now(),
      },
    ],
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
};

class ProfileManagerClass {
  private profile: ProfessionalProfile = { ...INITIAL_FARHAN_PROFILE };
  private suggestions: Map<string, ProfileSuggestion> = new Map();

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
        if (savedProfile) {
          this.profile = JSON.parse(savedProfile);
        }

        const savedSuggestions = window.localStorage.getItem(SUGGESTIONS_STORAGE_KEY);
        if (savedSuggestions) {
          const parsed = JSON.parse(savedSuggestions);
          if (Array.isArray(parsed)) {
            parsed.forEach((s: ProfileSuggestion) => {
              if (s && s.id) this.suggestions.set(s.id, s);
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
        window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
        window.localStorage.setItem(
          SUGGESTIONS_STORAGE_KEY,
          JSON.stringify(Array.from(this.suggestions.values()))
        );
      }
    } catch {
      // ignore
    }
  }

  public getProfile(scope: 'PUBLIC' | 'APPLICATION' | 'FULL' = 'FULL'): ProfessionalProfile {
    if (scope === 'FULL') {
      return { ...this.profile };
    }
    return this.getExportableProfile(scope);
  }

  /**
   * Authoritative profile update.
   * If isUser is false (agent attempting direct mutation), this is strictly blocked!
   */
  public updateProfile(
    updates: Partial<ProfessionalProfile>,
    isUser: boolean = true
  ): { success: boolean; error?: string; profile?: ProfessionalProfile } {
    if (!isUser) {
      return {
        success: false,
        error:
          'AUTHORIZATION ERROR: Agents cannot silently modify authoritative profile facts. Please submit a suggestion via suggestChange().',
      };
    }

    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: Date.now(),
      version: this.profile.version + 1,
    };
    this.save();

    EventBus.emit({
      id: generateId('ev_prof'),
      type: 'profile.updated',
      timestamp: this.profile.updatedAt,
      message: `Farhan Professional Profile updated (v${this.profile.version}).`,
      details: { version: this.profile.version },
    } as any);

    return { success: true, profile: { ...this.profile } };
  }

  public suggestChange(data: {
    agentId: string;
    reason: string;
    section: string;
    proposedChange: Record<string, unknown>;
  }): ProfileSuggestion {
    const id = generateId('sug');
    const suggestion: ProfileSuggestion = {
      id,
      agentId: data.agentId,
      reason: data.reason,
      section: data.section,
      proposedChange: data.proposedChange,
      status: 'PENDING',
      createdAt: Date.now(),
    };

    this.suggestions.set(id, suggestion);
    this.save();

    EventBus.emit({
      id: generateId('ev_prof_sug'),
      type: 'profile.approval.requested',
      timestamp: suggestion.createdAt,
      message: `Profile improvement suggested by ${data.agentId}: ${data.reason}`,
      agentId: data.agentId,
      section: data.section,
      suggestionId: id,
      details: data.proposedChange,
    } as any);

    return suggestion;
  }

  public getSuggestions(status?: string): ProfileSuggestion[] {
    const all = Array.from(this.suggestions.values());
    if (status) return all.filter((s) => s.status === status);
    return all;
  }

  public approveSuggestion(
    id: string,
    approvedBy: string = 'Farhan'
  ): { success: boolean; error?: string; profile?: ProfessionalProfile } {
    const suggestion = this.suggestions.get(id);
    if (!suggestion) return { success: false, error: `Suggestion ${id} not found.` };
    if (suggestion.status !== 'PENDING') {
      return { success: false, error: `Suggestion is already ${suggestion.status}.` };
    }

    suggestion.status = 'APPROVED';
    suggestion.decidedAt = Date.now();
    suggestion.decidedBy = approvedBy;

    const prop = suggestion.proposedChange;
    const updated = { ...this.profile };

    if (suggestion.section === 'skills' && Array.isArray(prop.newSkills)) {
      const cat = (prop.category as string) || 'tools';
      const currentSkills = (updated.skills as any)[cat] || [];
      (updated.skills as any)[cat] = Array.from(new Set([...currentSkills, ...prop.newSkills]));
      if (prop.verified) {
        updated.skills.verifiedSkills = Array.from(
          new Set([...updated.skills.verifiedSkills, ...prop.newSkills])
        );
      }
    } else if (suggestion.section === 'projects' && prop.project) {
      updated.projects = [...updated.projects, prop.project as any];
    } else if (suggestion.section === 'certifications' && prop.certification) {
      updated.certifications = [...updated.certifications, prop.certification as any];
    }

    const res = this.updateProfile(updated, true);
    this.save();
    return res;
  }

  public rejectSuggestion(id: string, rejectedBy: string = 'Farhan'): { success: boolean } {
    const suggestion = this.suggestions.get(id);
    if (!suggestion) return { success: false };
    suggestion.status = 'REJECTED';
    suggestion.decidedAt = Date.now();
    suggestion.decidedBy = rejectedBy;
    this.save();
    return { success: true };
  }

  /**
   * Promotes an unverified profile fact to verified.
   * STRICT SECURITY ENFORCEMENT:
   * Agents cannot promote unverified facts to verified facts.
   * Only Farhan (human operator, isUser: true) can perform fact promotion.
   */
  public promoteFact(
    section: 'projects' | 'education' | 'certifications' | 'achievements',
    itemId: string,
    isUser: boolean = true
  ): { success: boolean; error?: string } {
    if (!isUser) {
      return {
        success: false,
        error: 'SECURITY ENFORCEMENT ERROR: Agents cannot promote unverified facts to verified facts. Explicit human confirmation is required.',
      };
    }
    const list = this.profile[section] as Array<{ id: string; verified: boolean; provenance?: any }>;
    const item = list?.find((x) => x.id === itemId);
    if (!item) return { success: false, error: `Item ${itemId} not found in ${section}.` };
    item.verified = true;
    item.provenance = 'USER_CONFIRMED';
    this.save();
    return { success: true };
  }

  /**
   * Filters profile data according to visibility scope.
   * Strips PRIVATE data completely.
   */
  public getExportableProfile(scope: 'PUBLIC' | 'APPLICATION'): ProfessionalProfile {
    const isVisible = (vis: ProfileVisibility): boolean => {
      if (scope === 'PUBLIC') return vis === 'PUBLIC';
      if (scope === 'APPLICATION') return vis === 'PUBLIC' || vis === 'APPLICATION_ONLY';
      return false;
    };

    const identity = {
      ...this.profile.identity,
      fullName: isVisible(this.profile.identity.visibility.fullName || 'PUBLIC')
        ? this.profile.identity.fullName
        : 'Confidential Candidate',
      email: isVisible(this.profile.identity.visibility.email || 'APPLICATION_ONLY')
        ? this.profile.identity.email
        : '[Protected Email]',
      portfolioUrl: isVisible(this.profile.identity.visibility.portfolioUrl || 'PUBLIC')
        ? this.profile.identity.portfolioUrl
        : '',
      githubUrl: isVisible(this.profile.identity.visibility.githubUrl || 'PUBLIC')
        ? this.profile.identity.githubUrl
        : '',
      location: isVisible(this.profile.identity.visibility.location || 'PUBLIC')
        ? this.profile.identity.location
        : '',
    };

    return {
      ...this.profile,
      identity,
      education: this.profile.education.filter((e) => isVisible(e.visibility)),
      projects: this.profile.projects.filter((p) => isVisible(p.visibility)),
      experience: this.profile.experience.filter((x) => isVisible(x.visibility)),
      certifications: this.profile.certifications.filter((c) => isVisible(c.visibility)),
      achievements: this.profile.achievements.filter((a) => isVisible(a.visibility)),
    };
  }

  /**
   * Anti-Hallucination Fact Verifier:
   * Asserts that every claimed skill, technology, or project in a generated resume or outreach
   * corresponds to an existing, verified record in Farhan's authoritative profile.
   * STRICT PROVENANCE ENFORCEMENT:
   * Only items with verified === true and provenance USER_PROVIDED / USER_CONFIRMED are valid.
   */
  public verifyFactualAccuracy(claims: {
    skills?: string[];
    technologies?: string[];
    projects?: string[];
  }): { valid: boolean; unverifiedItems: string[] } {
    const unverified: string[] = [];
    const verifiedSkills = new Set(
      this.profile.skills.verifiedSkills.map((s) => s.toLowerCase().trim())
    );

    const verifiedProjects = new Set(
      this.profile.projects
        .filter((p) => p.verified && (p.provenance === 'USER_PROVIDED' || p.provenance === 'USER_CONFIRMED'))
        .map((p) => p.name.toLowerCase().trim())
    );

    if (claims.skills) {
      for (const skill of claims.skills) {
        if (!verifiedSkills.has(skill.toLowerCase().trim())) {
          unverified.push(`Skill: "${skill}"`);
        }
      }
    }

    if (claims.technologies) {
      for (const tech of claims.technologies) {
        if (!verifiedSkills.has(tech.toLowerCase().trim())) {
          unverified.push(`Technology: "${tech}"`);
        }
      }
    }

    if (claims.projects) {
      for (const proj of claims.projects) {
        if (!verifiedProjects.has(proj.toLowerCase().trim())) {
          unverified.push(`Project: "${proj}"`);
        }
      }
    }

    return {
      valid: unverified.length === 0,
      unverifiedItems: unverified,
    };
  }

  /**
   * Evaluates profile completeness without penalizing legitimately unconfirmed sections (e.g. certifications/achievements).
   */
  public getProfileCompleteness(): ProfileCompleteness {
    const p = this.profile;
    const hasIdentity = Boolean(
      p.identity.fullName &&
      p.identity.professionalHeadline &&
      p.identity.email &&
      p.identity.githubUrl
    );
    const hasEducation = p.education.length > 0 && Boolean(p.education[0].institution && p.education[0].institution !== 'Pending User Input');
    const hasProjects = p.projects.length > 0;
    const hasSkills = p.skills.verifiedSkills.length > 0;
    const hasExperience = p.experience.length > 0;

    // Legitimate 'none' sections are not penalized
    const certsStatus: 'none' | boolean = p.certifications.length > 0 ? true : 'none';
    const achsStatus: 'none' | boolean = p.achievements.length > 0 ? true : 'none';
    const docsStatus: 'none' | boolean = p.documents?.resumeVersions?.length > 0 ? true : 'none';

    const applicable = [hasIdentity, hasEducation, hasProjects, hasSkills, hasExperience];
    const completed = applicable.filter(Boolean).length;
    const score = Math.round((completed / applicable.length) * 100);

    return {
      score,
      sections: {
        identity: hasIdentity,
        education: hasEducation,
        projects: hasProjects,
        skills: hasSkills,
        experience: hasExperience,
        certifications: certsStatus,
        achievements: achsStatus,
        documents: docsStatus,
      },
      summary: `${completed} of ${applicable.length} core sections complete (${score}%). Certifications & Achievements: None confirmed (not penalized).`,
    };
  }

  /**
   * Generates targeted resume based on requested variant using strictly USER_CONFIRMED information.
   * Clearly represents Farhan as Student / Aspiring Software Developer / AI Builder.
   */
  public generateResume(variant: ResumeVariant = 'master'): {
    variant: ResumeVariant;
    title: string;
    targetRole: string;
    content: string;
  } {
    const matchingDoc = this.profile.documents.resumeVersions.find(
      (r) => r.id === `res_${variant}`
    );
    if (matchingDoc) {
      return {
        variant,
        title: matchingDoc.name,
        targetRole: matchingDoc.targetRole || 'Software Developer & AI Builder',
        content: matchingDoc.content,
      };
    }
    const master = this.profile.documents.resumeVersions[0];
    return {
      variant: 'master',
      title: master?.name || 'Master Resume',
      targetRole: master?.targetRole || 'Software Developer & AI Builder',
      content: master?.content || '',
    };
  }

  public reset(): void {
    this.profile = { ...INITIAL_FARHAN_PROFILE };
    this.suggestions.clear();
    this.save();
  }
}

export const ProfileManager = new ProfileManagerClass();
