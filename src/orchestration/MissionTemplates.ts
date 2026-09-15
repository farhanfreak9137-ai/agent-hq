import { InitiativeDefinition } from '../types/index.ts';

export const MISSION_TEMPLATES: Record<string, InitiativeDefinition> = {
  software_development: {
    id: 'tmpl_software_dev',
    title: 'Full-Stack Software Development Initiative',
    description: 'Deconstructs functional specs into API interfaces, frontend components, test suites, and peer review.',
    goal: 'Deliver a production-ready web service with strict type contracts and 100% test passing rate.',
    phases: [
      {
        name: 'Planning & Specs',
        tasks: [
          {
            id: 'task_sw_arch',
            title: 'Compile Architecture Blueprint & Data Schema',
            description: 'BOSS drafts system diagrams, database models, and service boundary contracts.',
            role: 'Orchestrator',
          },
        ],
      },
      {
        name: 'Implementation & UI',
        tasks: [
          {
            id: 'task_sw_backend',
            title: 'Develop REST API & Database Migration Routines',
            description: 'NOVA implements asynchronous request handlers, transactions, and validation logic.',
            role: 'Coder',
          },
          {
            id: 'task_sw_ui',
            title: 'Design Component Hierarchy & Visual HUD',
            description: 'PIXEL creates accessible UI mockups, design tokens, and stateful widgets.',
            role: 'Designer',
          },
        ],
      },
      {
        name: 'Quality Assurance',
        tasks: [
          {
            id: 'task_sw_audit',
            title: 'Rigorous Code Review & Memory Leak Audit',
            description: 'ECHO audits PR diffs for concurrency safety, unhandled rejections, and stylistic clean code.',
            role: 'Reviewer',
          },
          {
            id: 'task_sw_test',
            title: 'Execute Fuzzing & Regression Test Matrix',
            description: 'VECTOR executes end-to-end integration vectors and stress tests against endpoints.',
            role: 'Tester',
          },
        ],
      },
    ],
  },

  security_audit: {
    id: 'tmpl_security_audit',
    title: 'Comprehensive Zero-Trust Security Audit',
    description: 'Threat modeling, CVE vulnerability indexing, AST security inspection, and compliance certification.',
    goal: 'Audit entire attack surface and generate cryptographic certification sign-off.',
    phases: [
      {
        name: 'Threat Modeling',
        tasks: [
          {
            id: 'task_sec_recon',
            title: 'Index CVE Vulnerabilities & Attack Vectors',
            description: 'ATLAS scans public vulnerability databases and dependencies for known exploits.',
            role: 'Researcher',
          },
          {
            id: 'task_sec_threat_model',
            title: 'Construct Zero-Trust Boundary Matrix',
            description: 'SENTINEL maps authentication trust zones, token rotations, and ingress barriers.',
            role: 'Security Engineer',
          },
        ],
      },
      {
        name: 'Code Inspection',
        tasks: [
          {
            id: 'task_sec_ast',
            title: 'Static AST Audit for Injection & Leak Flaws',
            description: 'ECHO verifies input sanitization and secure parameter binding.',
            role: 'Reviewer',
          },
        ],
      },
      {
        name: 'Penetration & Sign-off',
        tasks: [
          {
            id: 'task_sec_chaos',
            title: 'Execute Chaos Authentication Ingestion Fuzzing',
            description: 'VECTOR tests rate limits and session hijacking vectors.',
            role: 'Tester',
          },
          {
            id: 'task_sec_signoff',
            title: 'Generate Cryptographic Security Audit Certificate',
            description: 'SENTINEL synthesizes final audit report and grants security clearance.',
            role: 'Security Engineer',
          },
        ],
      },
    ],
  },

  research_report: {
    id: 'tmpl_research_report',
    title: 'Technology Landscape & Competitive Benchmarking',
    description: 'Literature indexing, quantitative benchmark evaluation, architectural trade-off analysis, and executive synthesis.',
    goal: 'Produce a comprehensive research dossier with actionable engineering recommendations.',
    phases: [
      {
        name: 'Data Gathering',
        tasks: [
          {
            id: 'task_res_literature',
            title: 'Aggregate Benchmark Papers & Industry Reports',
            description: 'ATLAS indexes performance whitepapers and latency trade-off tables.',
            role: 'Researcher',
          },
        ],
      },
      {
        name: 'Trade-off Analysis',
        tasks: [
          {
            id: 'task_res_tradeoff',
            title: 'Synthesize Architectural Trade-offs & Cost Profiles',
            description: 'NOVA evaluates runtime memory footprints and algorithmic complexity.',
            role: 'Coder',
          },
        ],
      },
      {
        name: 'Executive Synthesis',
        tasks: [
          {
            id: 'task_res_dossier',
            title: 'Publish Strategic Technology Dossier',
            description: 'BOSS consolidates research findings into executive deliverables.',
            role: 'Orchestrator',
          },
        ],
      },
    ],
  },

  website_build: {
    id: 'tmpl_website_build',
    title: 'High-Performance Web Portal Deployment',
    description: 'Design system formulation, responsive layout engineering, Core Web Vitals optimization, and cross-browser testing.',
    goal: 'Build and deploy a responsive, high-performance web experience with pristine typography.',
    phases: [
      {
        name: 'Design Foundation',
        tasks: [
          {
            id: 'task_web_design',
            title: 'Formulate Design Tokens & Responsive Wireframes',
            description: 'PIXEL develops harmonious color palettes, fluid grids, and accessible components.',
            role: 'Designer',
          },
        ],
      },
      {
        name: 'Frontend Engineering',
        tasks: [
          {
            id: 'task_web_impl',
            title: 'Assemble Component Architecture & Micro-Interactions',
            description: 'NOVA builds responsive DOM structures with clean CSS and fast hydration.',
            role: 'Coder',
          },
        ],
      },
      {
        name: 'Cross-Device Verification',
        tasks: [
          {
            id: 'task_web_perf',
            title: 'Audit Lighthouse Scores & Layout Shift Bounds',
            description: 'VECTOR executes CWV audits ensuring sub-100ms INP and zero layout shifts.',
            role: 'Tester',
          },
        ],
      },
    ],
  },

  bug_investigation: {
    id: 'tmpl_bug_investigation',
    title: 'Root-Cause Analysis & Rapid Incident Mitigation',
    description: 'Failure log triangulation, regression reproduction, atomic patch compilation, and verification.',
    goal: 'Isolate transient bug, verify root cause, and deploy patch with zero regression.',
    phases: [
      {
        name: 'Triage & Log Analysis',
        tasks: [
          {
            id: 'task_bug_triage',
            title: 'Triangulate Event Logs & Exception Stack Traces',
            description: 'ATLAS isolates correlation IDs and telemetry anomalies in failed execution.',
            role: 'Researcher',
          },
        ],
      },
      {
        name: 'Patch & Verification',
        tasks: [
          {
            id: 'task_bug_patch',
            title: 'Author Atomic Hotfix & Concurrency Lock Guard',
            description: 'NOVA patches race condition and strengthens type constraints.',
            role: 'Coder',
          },
          {
            id: 'task_bug_regression',
            title: 'Execute Targeted Regression Test Vector',
            description: 'VECTOR verifies that the failure vector is resolved and no side-effects emerge.',
            role: 'Tester',
          },
        ],
      },
    ],
  },

  code_review: {
    id: 'tmpl_code_review',
    title: 'Multi-Agent PR Review & Security Gate',
    description: 'Dual-agent peer review loop with static analysis, security validation, and automated sign-off.',
    goal: 'Audit PR with bounded review cycles and merge clearance.',
    phases: [
      {
        name: 'Inspection',
        tasks: [
          {
            id: 'task_cr_static',
            title: 'Static AST & Linter Interface Compliance Check',
            description: 'ECHO audits code structure, naming semantics, and complexity score.',
            role: 'Reviewer',
          },
          {
            id: 'task_cr_sec',
            title: 'Boundary Guard & Token Safety Inspection',
            description: 'SENTINEL verifies that no private keys or unrestricted calls are introduced.',
            role: 'Security Engineer',
          },
        ],
      },
      {
        name: 'Sign-off',
        tasks: [
          {
            id: 'task_cr_merge',
            title: 'Final Architectural Clearance & Merge Recommendation',
            description: 'BOSS reviews peer verdicts and approves deployment.',
            role: 'Orchestrator',
          },
        ],
      },
    ],
  },
  lead_generation_outreach: {
    id: 'tmpl_lead_generation_outreach',
    title: 'Autonomous Lead Discovery, Strategy & Outreach Pipeline',
    description: 'Autonomous multi-stage prospecting workflow: deep research, strategic opportunity evaluation, CRM tracking, personalized outreach drafting, and fact-checking peer review with human sign-off.',
    goal: 'Identify verified business opportunities, record qualified prospects in CRM, and prepare personalized outreach drafts awaiting human approval.',
    phases: [
      {
        name: 'Intelligence & Research',
        tasks: [
          {
            id: 'task_lead_research',
            title: 'Gather Verified Public Company & Tech Stack Data',
            description: 'ATLAS aggregates verified public documentation, website structure, and market positioning without fabricating facts.',
            role: 'Researcher',
          },
        ],
      },
      {
        name: 'Strategic Opportunity Evaluation',
        tasks: [
          {
            id: 'task_lead_strategy',
            title: 'Evaluate Problem-Solution Fit & Service Scope',
            description: 'STRATEGIST analyzes research findings, determines capability fit, estimates project scope, and formulates structured recommendation.',
            role: 'Strategist',
          },
        ],
      },
      {
        name: 'CRM Qualification & Pipeline Tracking',
        tasks: [
          {
            id: 'task_lead_crm',
            title: 'Record Qualified Prospect & Enforce State Transitions',
            description: 'CRM verifies duplicate prevention, logs initial interaction, and transitions prospect to QUALIFIED lifecycle state.',
            role: 'CRM / Operations',
          },
        ],
      },
      {
        name: 'Personalized Outreach Drafting',
        tasks: [
          {
            id: 'task_lead_outreach',
            title: 'Generate Personalized Outreach Draft',
            description: 'OUTREACH crafts concise, relevant message referencing verified research and strategist recommendation. Flags requires_human_approval.',
            role: 'Outreach',
          },
        ],
      },
      {
        name: 'Peer Review & Fact Checking',
        tasks: [
          {
            id: 'task_lead_review',
            title: 'Fact-Check Claims & Anti-Spam Compliance',
            description: 'ECHO audits draft for accuracy against research evidence, ensuring no hallucinations or unauthorized claims.',
            role: 'Reviewer',
          },
        ],
      },
      {
        name: 'Executive Synthesis & Human Gate',
        tasks: [
          {
            id: 'task_lead_synthesis',
            title: 'Executive Mission Briefing & Approval Gate',
            description: 'BOSS compiles synthesized dossier with verified deliverables and halts for human operator approval before dispatch.',
            role: 'Orchestrator',
          },
        ],
      },
    ],
  },
  job_internship_pipeline: {
    id: 'tmpl_job_internship_pipeline',
    title: 'Professional Opportunity Discovery, Profile Matching & Application Pipeline',
    description: 'Autonomous multi-stage career opportunity workflow: discover verified positions, match against Farhan\'s Professional Profile, tailor resume without hallucinations, compose application draft, and hold for human sign-off.',
    goal: 'Discover verified engineering opportunities, match against Farhan\'s authoritative profile, generate tailored application package, and await human approval.',
    phases: [
      {
        name: 'Opportunity Discovery & Evidence Capture',
        tasks: [
          {
            id: 'task_opp_discovery',
            title: 'Discover & Verify Legitimate Public Opportunities',
            description: 'ATLAS aggregates verified public opportunities with source URLs, eligibility requirements, and deadlines without fabricating facts.',
            role: 'Researcher',
          },
        ],
      },
      {
        name: 'Profile Requirement Matching',
        tasks: [
          {
            id: 'task_opp_matching',
            title: 'Evaluate Profile-Opportunity Fit & Evidence',
            description: 'STRATEGIST compares requirements against Farhan\'s Professional Profile, identifying strong matches, gaps, and project evidence.',
            role: 'Strategist',
          },
        ],
      },
      {
        name: 'Tailored Resume Customization',
        tasks: [
          {
            id: 'task_opp_resume',
            title: 'Generate Tailored Resume from Verified Profile Facts',
            description: 'QUILL customizes resume emphasizing relevant verified skills and projects. Never invents technologies or metrics.',
            role: 'Writer',
          },
        ],
      },
      {
        name: 'Application Drafting & Review Dossier',
        tasks: [
          {
            id: 'task_opp_draft',
            title: 'Compose Application Message & Review Dossier',
            description: 'OUTREACH synthesizes concise tailored application message and review dossier with missing info and potential risks. Flags requires_human_approval.',
            role: 'Outreach',
          },
        ],
      },
      {
        name: 'Anti-Fabrication & Fact Audit',
        tasks: [
          {
            id: 'task_opp_fact_check',
            title: 'Audit Claims & Verify Profile Alignment',
            description: 'ECHO audits drafted application ensuring 100% factual accuracy against Farhan\'s profile with zero hallucinations.',
            role: 'Reviewer',
          },
        ],
      },
      {
        name: 'Executive Review & Human Approval Gate',
        tasks: [
          {
            id: 'task_opp_approval_gate',
            title: 'Present Application Review Gate & Halt for Human Approval',
            description: 'BOSS compiles complete review dossier (Target, Source, Eligibility, Resume, Message, Risks) and halts for Farhan\'s explicit authorization.',
            role: 'Orchestrator',
          },
        ],
      },
    ],
  },
};

