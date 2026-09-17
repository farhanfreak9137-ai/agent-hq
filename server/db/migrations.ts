import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

/**
 * Seed initial administrative & standard users, agents, and provider configs.
 */
export function seedDatabase(db: Database.Database): void {
  const now = Date.now();

  // 1. Seed Users if table is empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminHash = bcrypt.hashSync('adminpassword123', 10);
    const userHash = bcrypt.hashSync('userpassword123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('user_admin_01', 'admin', adminHash, 'ADMIN', now, now);
    insertUser.run('user_standard_01', 'user', userHash, 'USER', now, now);
  }

  // 2. Seed Provider Configurations if empty
  const provCount = db.prepare('SELECT COUNT(*) as count FROM provider_configs').get() as { count: number };
  if (provCount.count === 0) {
    const insertProv = db.prepare(`
      INSERT INTO provider_configs (id, name, is_enabled, timeout_ms, max_concurrency, models, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertProv.run(
      'mock',
      'Local Autonomous Engine',
      1,
      30000,
      4,
      JSON.stringify(['mock-engine-v1']),
      now,
      now
    );

    insertProv.run(
      'gemini',
      'Google Gemini Provider',
      1,
      45000,
      2,
      JSON.stringify(['gemini-2.5-flash', 'gemini-2.5-pro']),
      now,
      now
    );

    insertProv.run(
      'antigravity',
      'Google Antigravity Provider',
      1,
      60000,
      2,
      JSON.stringify(['antigravity-core']),
      now,
      now
    );
  }

  // 3. Seed Agents if empty
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  if (agentCount.count === 0) {
    const insertAgent = db.prepare(`
      INSERT INTO agents (id, name, role, system_directive, provider_id, status, capabilities, assigned_tools, current_room_id, position_x, position_y, stats, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultAgents = [
      {
        id: 'boss',
        name: 'BOSS',
        role: 'Orchestrator',
        system_directive: 'Autonomous central orchestrator and hierarchical task planner',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['orchestration'],
        assigned_tools: ['tool_task_planner'],
        current_room_id: 'room_command',
        position_x: 760,
        position_y: 155,
      },
      {
        id: 'nova',
        name: 'NOVA',
        role: 'Coder',
        system_directive: 'Principal software architect and implementation lead',
        provider_id: 'antigravity',
        status: 'IDLE',
        capabilities: ['coding'],
        assigned_tools: ['tool_code_analysis'],
        current_room_id: 'room_coding',
        position_x: 260,
        position_y: 160,
      },
      {
        id: 'atlas',
        name: 'ATLAS',
        role: 'Researcher',
        system_directive: 'Lead research scientist and intelligence analyst',
        provider_id: 'gemini',
        status: 'IDLE',
        capabilities: ['research'],
        assigned_tools: ['tool_search'],
        current_room_id: 'room_research',
        position_x: 260,
        position_y: 820,
      },
      {
        id: 'pixel',
        name: 'PIXEL',
        role: 'Designer',
        system_directive: 'Principal UI/UX architect and creative director',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['design'],
        assigned_tools: ['tool_design_system'],
        current_room_id: 'room_design',
        position_x: 260,
        position_y: 490,
      },
      {
        id: 'echo',
        name: 'ECHO',
        role: 'Reviewer',
        system_directive: 'Lead code auditor and architectural review authority',
        provider_id: 'antigravity',
        status: 'IDLE',
        capabilities: ['review'],
        assigned_tools: ['tool_file_inspection'],
        current_room_id: 'room_review',
        position_x: 1260,
        position_y: 820,
      },
      {
        id: 'sentinel',
        name: 'SENTINEL',
        role: 'Security',
        system_directive: 'Chief zero-trust security engineer and cryptographic auditor',
        provider_id: 'gemini',
        status: 'IDLE',
        capabilities: ['security'],
        assigned_tools: ['tool_security_scanner'],
        current_room_id: 'room_security',
        position_x: 1260,
        position_y: 160,
      },
      {
        id: 'vector',
        name: 'VECTOR',
        role: 'Tester',
        system_directive: 'Automated test engineer and chaos simulation specialist',
        provider_id: 'mock',
        status: 'IDLE',
        capabilities: ['testing'],
        assigned_tools: ['tool_test_runner'],
        current_room_id: 'room_testing',
        position_x: 1260,
        position_y: 490,
      },
    ];

    for (const a of defaultAgents) {
      insertAgent.run(
        a.id,
        a.name,
        a.role,
        a.system_directive,
        a.provider_id,
        a.status,
        JSON.stringify(a.capabilities),
        JSON.stringify(a.assigned_tools),
        a.current_room_id,
        a.position_x,
        a.position_y,
        JSON.stringify({ tasksCompleted: 0, tasksInProgress: 0, messagesSent: 0, messagesReceived: 0 }),
        now,
        now
      );
    }
  }

  // 4. Migration & Seed Farhan's Professional Profile if empty
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(opportunities)`).all() as Array<{ name: string }>;
    if (!tableInfo.some((col) => col.name === 'source_verification')) {
      db.prepare(`ALTER TABLE opportunities ADD COLUMN source_verification TEXT NOT NULL DEFAULT 'UNVERIFIED'`).run();
    }
  } catch {
    // ignore
  }

  const profileCount = db.prepare('SELECT COUNT(*) as count FROM professional_profile').get() as { count: number };
  if (profileCount.count === 0) {
    const defaultProfile = {
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
            content: `# Md Farhan Hossain (Farhan)\nSoftware Developer & AI Builder\nEmail: farhanfreak9137@gmail.com | Location: Dhaka, Bangladesh\nGitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/\n\n---\n### Summary\nStudent and aspiring software developer with verified personal and student project experience in modern web development, multi-agent systems, and AI integration. Active builder of full-stack TypeScript/React tools and AI applications.\n\n---\n### Education\n- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027\n- **Milestone College** — Higher Secondary Education (Previous College)\n- **Mdc Model School and College** — Secondary School Certificate (SSC), 2025 (GPA: 4.11)\n*(Note: High school student; has not completed university education).*\n\n---\n### Work Experience\n- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)\n  - Operated point-of-sale (POS) terminals and managed retail transactions.\n  - Stepped down to focus on academic improvement.\n\n---\n### Personal & Student Projects\n- **Agent HQ** (Active Project) — Multi-agent orchestration platform.\n- **Auren** (Active Personal Project) — Windows-focused AI assistant / cognitive OS.\n- **HSC AI Study Intelligence System** (Active Student Project) — HSC Science AI study system.\n- **Atlas** (Personal Project) — Productivity application.\n- **Gym Tracker** (Personal Project) — Fitness tracking application.`,
            updatedAt: now,
          },
          {
            id: 'res_frontend',
            name: 'Frontend Developer Resume',
            targetRole: 'Frontend Developer / Web Applications',
            content: `# Md Farhan Hossain (Farhan)\nFrontend Developer & Web Builder\nEmail: farhanfreak9137@gmail.com | GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/\n\n---\n### Profile\nStudent and aspiring frontend developer proficient in React, Next.js, TypeScript, and modern CSS/Tailwind.\n\n---\n### Education\n- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027\n- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)\n\n---\n### Work Experience\n- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)\n  - Managed point-of-sale customer checkouts and retail transactions. Stepped down to focus on academic improvement.\n\n---\n### Key Frontend Projects\n- **Agent HQ UI** — Responsive 2D canvas workspace with React, TypeScript, and Tailwind CSS.\n- **Atlas** — Personal productivity application with Next.js and React.\n- **HSC AI Study Interface** — Interactive educational app with KaTeX and Capacitor.\n- **Gym Tracker** — Fitness logging user interface built with React and TypeScript.`,
            updatedAt: now,
          },
          {
            id: 'res_ai',
            name: 'AI Developer Resume',
            targetRole: 'AI Application & Multi-Agent Builder',
            content: `# Md Farhan Hossain (Farhan)\nAI Application Developer & Multi-Agent Builder\nEmail: farhanfreak9137@gmail.com | GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/\n\n---\n### Profile\nAspiring developer specializing in practical AI integration, multi-agent systems, and generative AI applications.\n\n---\n### Education\n- **Pallabi Government College** — HSC 2nd Year (Science), Expected 2027\n- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)\n\n---\n### Work Experience\n- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)\n  - Managed point-of-sale customer checkouts and transactions. Stepped down to focus on academic improvement.\n\n---\n### Featured AI Projects\n- **Agent HQ** — Multi-agent orchestration engine with DAG task execution, tool use, and memory.\n- **Auren** — Windows-focused AI assistant exploring local AI inference and cognitive memory.\n- **HSC AI Study Intelligence System** — AI-assisted study workflows with RAG question answering.`,
            updatedAt: now,
          },
          {
            id: 'res_internship',
            name: 'Student Internship Resume',
            targetRole: 'Software Development / AI Intern',
            content: `# Md Farhan Hossain (Farhan)\nHSC Science Student & Aspiring Software Developer\nEmail: farhanfreak9137@gmail.com | Location: Dhaka, Bangladesh\nGitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/\n\n---\n### Objective\nEnthusiastic HSC 2nd Year Science student seeking a software development or AI engineering internship to apply practical skills in TypeScript, React, Node.js, and autonomous agent systems.\n\n---\n### Academic Background\n- **Pallabi Government College** — HSC 2nd Year (Science stream), Expected 2027\n- **Milestone College** — Higher Secondary Education\n- **Mdc Model School and College** — SSC, 2025 (GPA: 4.11)\n\n---\n### Work Experience\n- **Shwapno** — Checkout Assistant / POS Cashier (July 30, 2025 – December 20, 2025)\n  - Demonstrated punctuality, cash-handling accuracy, customer service, and team coordination.\n\n---\n### Demonstrated Project Experience\n- **Agent HQ** — Multi-agent operations platform built with TypeScript, React, and Node.js.\n- **HSC AI Study System** — AI-assisted study system using React, TypeScript, and RAG.\n- **Atlas & Gym Tracker** — Personal productivity and utility web applications.`,
            updatedAt: now,
          },
        ],
        coverLetterTemplates: [
          {
            id: 'cov_student_intern',
            name: 'Student Internship Application Letter',
            template: `Dear Hiring Team,\n\nI am writing to apply for the internship opportunity at your organization.\n\nI am currently an HSC 2nd Year Science student at Pallabi Government College with a strong passion for software engineering and AI systems. Through personal and student projects—such as building Agent HQ (a TypeScript/React multi-agent platform) and the HSC AI Study System—I have developed hands-on technical skills in full-stack development, modern web APIs, and practical AI integration.\n\nIn addition to my technical curiosity, my previous experience as a Checkout Assistant at Shwapno helped me cultivate reliability, attention to detail, and a disciplined work ethic. I am eager to learn, contribute, and collaborate with your team.\n\nSincerely,\nMd Farhan Hossain (Farhan)`,
            updatedAt: now,
          },
        ],
      },
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    db.prepare(`
      INSERT INTO professional_profile (id, data, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('farhan_profile_master', JSON.stringify(defaultProfile), 1, now, now);
  }

  // 5. Seed Initial Real Opportunities if empty
  const oppCount = db.prepare('SELECT COUNT(*) as count FROM opportunities').get() as { count: number };
  if (oppCount.count === 0) {
    const insertOpp = db.prepare(`
      INSERT INTO opportunities (
        id, title, organization, type, source, source_url, location, remote,
        description, requirements, eligibility, deadline, discovered_at,
        matched_skills, missing_skills, evidence, fit_analysis, status,
        application_draft_id, source_verification, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOpp.run(
      'opp_seed_1',
      'Full-Stack TypeScript & React Engineering Intern',
      'Vercel Ecosystem Labs',
      'internship',
      'GitHub Careers & Public Ecosystem',
      'https://github.com/careers/ecosystem-internships',
      'Remote (Worldwide)',
      1,
      'Build responsive web applications and developer tools utilizing Next.js, React, and modern TypeScript workflows.',
      JSON.stringify(['React', 'Next.js', 'TypeScript', 'Tailwind CSS']),
      JSON.stringify(['Enrolled in Computer Science or related degree', 'Strong familiarity with modern web APIs']),
      '2026-10-15',
      now - 86400000,
      JSON.stringify(['React', 'TypeScript', 'Tailwind CSS']),
      JSON.stringify([]),
      JSON.stringify(['Agent HQ: React & TypeScript multi-agent architecture']),
      JSON.stringify({
        strongMatches: ['React', 'TypeScript', 'Tailwind CSS'],
        potentialGaps: [],
        eligibilityChecks: [
          { criterion: 'Student Status', status: 'VERIFY', details: 'Enrollment unconfirmed in authoritative profile' },
          { criterion: 'Remote Eligibility', status: 'MATCH', details: 'Remote worldwide position' },
        ],
        evidence: ['Agent HQ'],
        matchPercentage: 100,
        reasoning: 'Demonstrates strong match with verified Agent HQ stack.',
      }),
      'QUALIFIED',
      null,
      'DEMO',
      now - 86400000,
      now
    );

    insertOpp.run(
      'opp_seed_2',
      'Autonomous AI Systems Engineer',
      'Nexus AI Research Partner',
      'job',
      'Tech Opportunity Board',
      'https://jobs.tech/nexus-ai-systems-engineer',
      'Remote',
      1,
      'Design, build, and optimize multi-agent orchestration frameworks, low-latency prompt pipelines, and autonomous reasoning loops.',
      JSON.stringify(['TypeScript', 'Python', 'Multi-Agent Systems', 'LLM Orchestration', 'SQLite']),
      JSON.stringify(['Demonstrated portfolio of production agentic systems', 'High proficiency in concurrency and systems architecture']),
      '2026-11-01',
      now - 172800000,
      JSON.stringify(['TypeScript', 'Python', 'Multi-Agent Systems', 'SQLite']),
      JSON.stringify([]),
      JSON.stringify(['Agent HQ: Multi-agent concurrent operating system']),
      JSON.stringify({
        strongMatches: ['TypeScript', 'Python', 'Multi-Agent Systems', 'SQLite'],
        potentialGaps: [],
        eligibilityChecks: [
          { criterion: 'Production Agent Experience', status: 'MATCH', details: 'Built Agent HQ from scratch' },
          { criterion: 'Remote Location', status: 'MATCH', details: 'Position supports global remote' },
        ],
        evidence: ['Agent HQ'],
        matchPercentage: 100,
        reasoning: 'Direct alignment with Agent HQ architecture and autonomous reasoning loops.',
      }),
      'QUALIFIED',
      null,
      'DEMO',
      now - 172800000,
      now
    );

    insertOpp.run(
      'opp_seed_3',
      'Global Autonomous Agents Hackathon 2026',
      'Google Cloud & Devpost',
      'hackathon',
      'Devpost',
      'https://devpost.com/hackathons/global-agents-2026',
      'Virtual / Global',
      1,
      'Build creative multi-agent autonomous applications leveraging Gemini APIs and Antigravity tooling.',
      JSON.stringify(['Multi-Agent Systems', 'Gemini API', 'TypeScript']),
      JSON.stringify(['Open to individual creators and teams worldwide']),
      '2026-10-30',
      now - 43200000,
      JSON.stringify(['Multi-Agent Systems', 'Gemini API', 'TypeScript']),
      JSON.stringify([]),
      JSON.stringify(['Agent HQ multi-agent core with Gemini integration']),
      JSON.stringify({
        strongMatches: ['Multi-Agent Systems', 'Gemini API', 'TypeScript'],
        potentialGaps: [],
        eligibilityChecks: [
          { criterion: 'Global Eligibility', status: 'MATCH', details: 'Open to worldwide developers' },
        ],
        evidence: ['Agent HQ'],
        matchPercentage: 100,
        reasoning: 'Perfect match for Farhan’s established Agent HQ system.',
      }),
      'DISCOVERED',
      null,
      'DEMO',
      now - 43200000,
      now
    );
  }
}

/**
 * Resets the database and re-seeds it. Intended for development & tests only.
 */
export function resetDatabase(db: Database.Database): void {
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM events;
    DELETE FROM memory_entries;
    DELETE FROM messages;
    DELETE FROM task_executions;
    DELETE FROM task_dependencies;
    DELETE FROM tasks;
    DELETE FROM missions;
    DELETE FROM outreach_drafts;
    DELETE FROM prospects;
    DELETE FROM job_applications;
    DELETE FROM opportunities;
    DELETE FROM profile_suggestions;
    DELETE FROM professional_profile;
    DELETE FROM agents;
    DELETE FROM provider_configs;
    DELETE FROM users;
  `);
  seedDatabase(db);
}


/**
 * Resumable orchestration recovery:
 * Scans for tasks that were in RUNNING or ASSIGNED state when the server stopped.
 * Transitions them to INTERRUPTED state to prevent duplicate/hanging executions.
 */
export function recoverInterruptedTasks(db: Database.Database): number {
  const now = Date.now();
  const interrupted = db.prepare(`
    SELECT id, title, mission_id, assigned_agent_id
    FROM tasks
    WHERE status IN ('RUNNING', 'ASSIGNED')
  `).all() as { id: string; title: string; mission_id: string | null; assigned_agent_id: string | null }[];

  if (interrupted.length === 0) {
    return 0;
  }

  const updateStmt = db.prepare(`
    UPDATE tasks
    SET status = 'INTERRUPTED', error = 'Execution interrupted by server restart.'
    WHERE id = ?
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, actor_id, actor_name, action, resource, resource_id, success, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (id, type, timestamp, message, agent_id, task_id, mission_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const t of interrupted) {
      updateStmt.run(t.id);
      insertAudit.run(
        `audit_${t.id}_${now}`,
        'system',
        'SYSTEM_RECOVERY',
        'task.interrupted_recovered',
        'task',
        t.id,
        1,
        JSON.stringify({ reason: 'server_restart', previousStatus: 'RUNNING' }),
        now
      );
      insertEvent.run(
        `ev_${t.id}_${now}`,
        'task.interrupted',
        now,
        `Task "${t.title}" was marked INTERRUPTED following server recovery.`,
        t.assigned_agent_id,
        t.id,
        t.mission_id,
        JSON.stringify({ recovered: true })
      );
    }
  });

  tx();
  return interrupted.length;
}
