# Agent HQ

A multi-agent orchestration and operations platform featuring persistent state, opportunity intelligence, professional profile grounding, strict human approval boundaries, and event-driven telemetry.

```mermaid
graph TD
    User([User / Human Operator]) --> HQ[Agent HQ Platform]
    HQ --> Orch[Multi-Agent Orchestration & DAG Scheduler]
    HQ --> EB[Typed EventBus & Real-Time Telemetry]
    HQ --> Prof[Authoritative Professional Profile (Immutable)]
    HQ --> Opp[Opportunity HQ]
    HQ --> Prosp[Autonomous Prospecting Engine]

    subgraph "Opportunity HQ Pipeline"
        Opp --> OppDisc[Source Discovery Adapters]
        OppDisc --> OppNorm[Normalization & Sanitization]
        OppNorm --> OppDedup[Deduplication & UNVERIFIED Persistence]
        OppDedup --> OppMatch[Deterministic Requirement Matching]
        OppMatch --> OppVer[Explicit Human Verification Gate]
        OppVer --> OppApp[Tailored Application Preparation]
    end

    subgraph "Prospecting Pipeline"
        Prosp --> Strat[Strategist Agent]
        Prosp --> CRM[CRM Lifecycle Pipeline]
        Prosp --> Outreach[Outreach Drafting (Human Gate)]
    end
```

---

## Core Capabilities

* **Multi-Agent Orchestration**: Coordinate specialized agents (Boss, Nova, Strategist, CRM, Outreach, Echo) across concurrent DAG workflows.
* **DAG Workflows & Execution**: Graph-based task dependencies, concurrency backpressure controls, and failure cascading.
* **Agent Memory & Context Isolation**: Four-tier memory architecture (Working, Task, Persistent, Semantic) with multi-signal relevance scoring and temporal decay.
* **Typed EventBus Telemetry**: System-wide reactive pub/sub event stream tracking lifecycle milestones, agent messages, and pipeline transitions.
* **Public Opportunity Discovery**: Extensible source adapter engine discovering real technical roles, internships, hackathons, and competitions from public job boards.
* **Source Provenance Integrity**: Full tracking of external identifiers, canonical URLs, publication timestamps, and adapter origins across the entire lifecycle.
* **Deterministic Requirement Matching**: Transparent mathematical matching against verified candidate skills and portfolio evidence, without subjective or hallucinated LLM scoring.
* **Professional Profile Grounding**: Single source of truth candidate profile guarded by strict provenance rules (`USER_CONFIRMED` / `USER_PROVIDED`).
* **Explicit Human Verification Gate**: Discovered opportunities remain strictly unverified until a human operator audits the canonical source.
* **Tailored Application Preparation**: Grounded resume and cover letter drafting adhering strictly to verified profile facts, highlighting gaps and eligibility warnings.
* **CRM & Prospect Management**: Structured pipeline managing company research, interaction history, qualification stages, and engagement status.
* **Outreach Drafting with Approval Gates**: Generates outreach messaging held in `AWAITING_APPROVAL` status; outbound transmission requires explicit human sign-off.
* **SQLite Persistence**: Local WAL-mode SQLite database with crash recovery, session restoration, and audit logging.

---

## Opportunity Discovery Engine

Opportunity HQ discovers legitimate public opportunities and brings them through an explicit, transparent evaluation pipeline:

```
External Source (e.g., Arbeitnow Public API)
       │
       ▼
Source Adapter (ArbeitnowOpportunityAdapter)
       │
       ▼
Data Normalization & HTML Sanitization
       │
       ▼
Deduplication Guard (URL & Org/Title matching)
       │
       ▼
Persistence (Strictly marked as UNVERIFIED)
       │
       ▼
Eligibility & Technical Requirement Matching
       │
       ▼
Explicit Human Verification Gate
       │
       ▼
Candidate Review & Tailored Application Preparation
```

> **IMPORTANT**: Discovered opportunities are **NEVER** automatically marked as verified. All discovered postings enter the pipeline with `sourceVerification = 'UNVERIFIED'`. Changing an opportunity to `VERIFIED` requires an explicit, confirmed action by a human operator after auditing the canonical employer source.

---

## Security & Integrity Model

Agent HQ enforces strict security boundaries designed for safe human-in-the-loop autonomous operations:

1. **Profile Facts Are Protected**: Professional profile facts require `USER_CONFIRMED` or `USER_PROVIDED` provenance. Agents cannot directly mutate, overwrite, or embellish candidate facts.
2. **Zero Automated Verification**: Discovery, matching, eligibility checks, and scraping cannot alter verification state. Verification requires an explicit human action.
3. **Zero Autonomous Applications**: No application can be drafted or submitted without human direction. Application drafts are held in `AWAITING_APPROVAL` and submission tools enforce approval state.
4. **Zero Autonomous Outreach**: Outreach drafts cannot be dispatched without explicit human sign-off.
5. **Deterministic Fit Analysis**: Matching percentage uses the transparent formula `Math.round(matchedRequirements / totalRequirements * 100)`. Unmatched requirements are explicitly surfaced as gaps.
6. **Provenance Preservation**: Verification preserves original discovery metadata (`sourceId`, `sourceName`, `sourceUrl`, `applicationUrl`, `discoveredAt`).
7. **Local Data Ownership**: SQLite persistence keeps profile facts, opportunity records, audit logs, and provider configurations on the user's system without third-party leakages.

---

## Validated Test Suite

All platform subsystems are verified via an automated test harness covering unit, integration, and load suites:

* **Opportunity Discovery Engine**: **14/14 tests passing (100%)**
  - Adapter lifecycle & mock isolation
  - Data normalization & missing-field resilience
  - Duplicate detection & deduplication guards
  - Strict `UNVERIFIED` persistence
  - Event semantics (zero false `verification.completed` events)
  - Fit analysis & deterministic matching integration
  - Profile immutability under discovery
  - Zero autonomous side-effects (no auto-apply, no auto-outreach)
  - Concurrency collision protection (HTTP 409 handling)
  - Adapter fault isolation & error resilience
  - Real public adapter integration (Arbeitnow API)
  - Verification gate negative paths & provenance preservation
* **Farhan Professional Profile & Opportunity HQ**: **27/27 tests passing (100%)**
  - Authoritative profile CRUD & WAL persistence
  - Direct mutation rejection across repos & managers
  - Field visibility filtering (`PUBLIC`, `APPLICATION_ONLY`, `FULL`)
  - Agent profile suggestion approval queue
  - Anti-fabrication fact-checking
  - Application draft generation & approval gate enforcement
  - Multi-variant tailored resume generation
* **Prospecting Agents (Strategist, CRM, Outreach)**: **15/15 tests passing (100%)**
  - Structured company fit analysis
  - Uncertainty tracking for unverified facts
  - CRM state machine transitions & duplicate prevention
  - Outreach drafting with strict human approval enforcement
  - Security boundary enforcement across agent capabilities
* **Production Infrastructure & Scalability**:
  - Resumable orchestration & server restart recovery
  - Authentication, password hashing, and session verification
  - 50-Agent / 100-Task multi-tiered DAG load test with backpressure control
* **Type Safety & Linting**:
  - Full TypeScript compilation (`npx tsc --noEmit`): **0 errors**
  - Project linter (`npm run lint`): **0 errors**

---

## Getting Started

### Prerequisites

* Node.js (v20+ recommended)
* npm

### Installation & Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/farhanfreak9137-ai/agent-hq.git
   cd agent-hq
   npm install
   ```

2. Configure environment (optional):
   ```bash
   cp .env.example .env
   ```

3. Run the development environment:
   ```bash
   # Terminal 1: Start backend API server
   npm run server

   # Terminal 2: Start frontend UI
   npm run dev
   ```

4. Run the full test suite:
   ```bash
   npm test
   npm run lint
   npx tsc --noEmit
   ```
