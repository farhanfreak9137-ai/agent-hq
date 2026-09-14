# Agent HQ — Operator & Task Execution Manual

Welcome to **Agent HQ**, an enterprise-grade multi-agent operating system coupled to a live 2D Canvas office visualization. This manual provides a complete, step-by-step operational guide explaining:
1. **What tasks already exist in the system**
2. **How to give tasks to agents (all methods)**
3. **How to operate, control, and inspect agents**
4. **What executes under the hood when a task is dispatched**

---

## 1. The Autonomous Team: Who Are the Agents?

Agent HQ comes with 7 specialized autonomous agents, each stationed at their dedicated office workstation:

| Agent | Role | Symbol | Room / Desk | Core Capabilities & Specialty | Default Provider |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **BOSS** | `Orchestrator` | 👑 | Command Center (`room_command`) | High-level goal decomposition, DAG generation, task delegation, deliverable approval | Mock / Antigravity |
| **NOVA** | `Coder` | 💻 | Dev Wing (`room_coding`) | System architecture, backend APIs, distributed concurrency, TypeScript/Node.js | Antigravity / Gemini |
| **ATLAS** | `Researcher` | 🔍 | Research Lab (`room_research`) | Benchmark analysis, technical papers, CVE vulnerability indexing, knowledge retrieval | Gemini |
| **PIXEL** | `Designer` | 🎨 | Creative Studio (`room_design`) | UI wireframes, color palettes, responsive spatial layout, design system tokens | Mock |
| **ECHO** | `Reviewer` | 📋 | Review Bay (`room_review`) | Static AST inspection, race condition detection, peer reviews, code consistency | Antigravity |
| **VECTOR** | `Tester` | ⚡ | QA Arena (`room_testing`) | Chaos penetration fuzzing, integration regression suites, latency profiling | Mock |
| **SENTINEL** | `Security Engineer` | 🛡️ | Security Center (`room_security`) | Zero-trust modeling, cryptographic barriers, dependency SBOM audit, threat mitigation | Gemini |

---

## 2. What Tasks Are Already in the System?

Agent HQ includes two categories of predefined tasks: **Seed Demonstration Tasks** and **Pre-Configured Multi-Agent Initiatives**.

### A. Active Pre-Loaded Tasks (Seed Data)
When you first start Agent HQ, the task board comes populated with realistic engineering initiatives:

1. **Implement Zero-Trust Auth Module** (`task_demo_1`)
   - **Assignee:** NOVA (Coder)
   - **Status:** In Progress
   - **Priority:** High
   - **Details:** JWT session signing with asymmetric Ed25519 keys, token revocation lists, and rate-limiting middleware.
2. **Analyze Vector Database Benchmarks** (`task_demo_2`)
   - **Assignee:** ATLAS (Researcher)
   - **Status:** In Progress
   - **Priority:** Medium
   - **Details:** Comparative latency and recall analysis between HNSW, IVF-PQ, and ScaNN algorithms for agent memory storage.
3. **Audit Pull Request #402 (Event Stream)** (`task_demo_3`)
   - **Assignee:** ECHO (Reviewer)
   - **Status:** Review
   - **Priority:** High
   - **Dependencies:** Blocked until `task_demo_1` completes.
   - **Details:** Static analysis and architectural review for reactive event bus concurrency limits and memory leak prevention.
4. **Run End-to-End Stress Test Suite** (`task_demo_4`)
   - **Assignee:** VECTOR (Tester)
   - **Status:** Testing
   - **Priority:** Critical
   - **Details:** 1,000 simulated concurrent agent workflows to verify zero packet drop and deterministic state transitions.
5. **Run Automated Security & CVE Audit** (`task_demo_5`)
   - **Assignee:** SENTINEL (Security Engineer)
   - **Status:** In Progress
   - **Priority:** Critical
   - **Details:** Container layer scanning, SBOM inspection, and dependency vulnerability auditing.
6. **Design Spatial Office Layout & HUD Themes** (`task_demo_6`)
   - **Assignee:** PIXEL (Designer)
   - **Status:** Completed
   - **Priority:** Medium
   - **Details:** 2D office layouts, color harmonies, avatar accessories, and HUD widgets.

---

### B. Built-In Mission Initiative Templates
Located in `src/orchestration/MissionTemplates.ts`, these are complete multi-stage DAG (Directed Acyclic Graph) initiatives that can be launched with a single click:

1. **Full-Stack Software Development Initiative** (`software_development`)
   - *Phase 1:* Architecture Blueprint & Data Schema (BOSS)
   - *Phase 2 (Parallel):* REST API & Backend Implementation (NOVA) + Component Hierarchy & HUD Design (PIXEL)
   - *Phase 3 (Parallel):* Rigorous Code Review & Memory Leak Audit (ECHO) + Fuzzing & Regression Test Matrix (VECTOR)
2. **Comprehensive Zero-Trust Security Audit / Operation Aegis** (`security_audit`)
   - *Phase 1 (Parallel):* Index CVE Vulnerabilities (ATLAS) + Zero-Trust Boundary Matrix (SENTINEL)
   - *Phase 2:* Static AST Audit for Injection & Leak Flaws (ECHO)
   - *Phase 3 (Parallel):* Chaos Authentication Ingestion Fuzzing (VECTOR) + Final Cryptographic Security Certificate Sign-Off (SENTINEL)
3. **Technology Landscape & Competitive Benchmarking** (`research_report`)
   - *Phase 1:* Aggregate Benchmark Papers & Industry Reports (ATLAS)
   - *Phase 2:* Synthesize Architectural Trade-offs & Cost Profiles (NOVA)
   - *Phase 3:* Publish Strategic Technology Dossier (BOSS)
4. **High-Performance Web Portal Deployment** (`website_build`)
   - *Phase 1:* Design Tokens & Responsive Wireframes (PIXEL)
   - *Phase 2:* Assemble Component Architecture & Micro-Interactions (NOVA)
   - *Phase 3:* Audit Lighthouse Scores & Layout Shift Bounds (VECTOR)
5. **Root-Cause Analysis & Rapid Incident Mitigation** (`bug_investigation`)
   - *Phase 1:* Triangulate Event Logs & Exception Stack Traces (ATLAS)
   - *Phase 2 (Parallel):* Author Atomic Hotfix (NOVA) + Targeted Regression Test Vector (VECTOR)
6. **Multi-Agent PR Review & Security Gate** (`code_review`)
   - *Phase 1 (Parallel):* Static AST Compliance Check (ECHO) + Boundary Guard & Token Safety Inspection (SENTINEL)
   - *Phase 2:* Final Architectural Clearance & Merge Recommendation (BOSS)
7. **Competing Solutions Evaluation**
   - Dispatches competing architectural prototypes to both NOVA and SENTINEL in parallel, followed by benchmarking by VECTOR and synthesis by BOSS.

---

## 3. How to Give Agents Tasks (Step-by-Step)

You can assign tasks to agents through multiple intuitive interfaces:

### Method 1: Dispatch a Direct Individual Task (Quickest)
Use this when you want an individual agent (or unassigned queue) to perform a specific action.

1. In the top navigation bar, click the **"+ New Task"** button.
2. In the modal that appears:
   - **Task Title:** Enter what needs to be done (e.g., `Refactor database connection pool`).
   - **Description & Requirements:** Add any constraints, paths, or deliverables.
   - **Priority Level:** Choose `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
   - **Assignee:** Select a specific agent (NOVA, ATLAS, SENTINEL, etc.) or choose `Unassigned (Queue)`.
   - *(Optional)* Click one of the **Quick Presets** at the bottom to auto-fill common tasks.
3. Click **"Dispatch Task"**.
4. **What happens immediately:**
   - The task is registered in the `TaskManager` and persisted in the SQLite database.
   - BOSS announces the assignment to the assigned agent via inter-agent messaging.
   - The assigned agent transitions from `IDLE` to `STARTING` → `THINKING` → `TOOL_EXECUTION` → `COMPLETED`.
   - The agent's speech bubble and thought bubble will display their current operation live in the 2D office.

---

### Method 2: Launch a Pre-Built Multi-Agent Mission
Use this when you want the team to collaborate in an organized sequence of phases.

1. In the top navigation bar, click **"Missions"** (or the Operations Dashboard button).
2. Look at the **"Select Initiative Template"** dropdown.
3. Pick one of the 6 available initiatives (e.g. *Full-Stack Software Development Initiative*, *Comprehensive Zero-Trust Security Audit*, etc.).
4. Click **"Deploy Initiative"**.
   - *Alternatively:* Click the prominent **"Launch Operation Aegis"** or **"Run Competing Evaluation"** button.
5. **What happens immediately:**
   - BOSS acts as the Orchestrator, compiling the initiative into a Directed Acyclic Graph (DAG).
   - Independent tasks are scheduled in parallel batches.
   - Dependent tasks are held in `PENDING` status until upstream tasks report `COMPLETED`.
   - You can watch the real-time progress bar, task status icons, and live telemetry in the dashboard.

---

### Method 3: Delegate a Free-Form Custom Objective to BOSS
Use this when you have a unique, custom goal and want BOSS to automatically analyze, decompose, and assign it to the right team members.

1. Open the **"Missions"** dashboard.
2. Click the **"+ Custom Objective"** button.
3. In the modal:
   - **Mission Objective / Goal:** State your desired outcome (e.g., `Build and audit a real-time Redis Pub/Sub caching layer`).
   - **Context & Constraints:** Provide specifications (e.g., `Ensure sub-5ms latency and zero memory leaks`).
4. Click **"Decompose & Launch DAG"**.
5. **What happens immediately:**
   - `TaskPlanner.decomposeGoal()` breaks your prompt into a 3-phase DAG:
     - Phase 1: Planning / Research (ATLAS or BOSS)
     - Phase 2: Implementation / Security (NOVA or SENTINEL)
     - Phase 3: Review / QA (ECHO or VECTOR)
   - BOSS announces the custom mission to the office, and the scheduler dispatches each node autonomously.

---

### Method 4: Run the Interactive Demo Mission
If you want to immediately see all agents coordinate across rooms with camera tracking:
1. In the top navigation bar, click **"Demo Mission"**.
2. The camera smoothly zooms into the Command Room, and BOSS initiates an animated 8-step operational briefing with messages flying between desks.

---

### Method 5: Via REST API / Programmatic Commands
Agent HQ exposes a full REST API on port `3001`:

#### Create a Task:
```bash
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Benchmark cryptographic signature speeds",
    "description": "Evaluate Ed25519 vs RSA-4096 throughput",
    "priority": "HIGH",
    "assignedAgentId": "sentinel",
    "providerId": "gemini"
  }'
```

#### Execute a Task through Backend AI Bridge:
```bash
curl -X POST http://localhost:3001/api/tasks/execute \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_custom_101",
    "agentId": "nova",
    "agentName": "NOVA",
    "role": "Coder",
    "title": "Scaffold WebSocket handler",
    "description": "Implement backpressure queue in TypeScript",
    "providerId": "antigravity"
  }'
```

---

## 4. How to Operate and Control the System

Agent HQ provides deep visibility and manual overrides:

### A. Simulation Controls (Top Bar)
- **Play / Pause (Spacebar / Button):** Pauses or resumes the entire office runtime and scheduled tasks.
- **Speed Multiplier:** Switch between `0.5x`, `1.0x`, `2.0x`, and `5.0x` execution speed.
- **Reset:** Resets all agents to their default desk positions and clears transient state.
- **Task Board:** Opens the Kanban board showing all tasks grouped by status (`PENDING`, `IN_PROGRESS`, `REVIEW`, `TESTING`, `COMPLETED`).

### B. 2D Office World Controls
- **Left-Click an Agent:** Opens the **Agent Inspector** panel for that agent.
- **Click & Drag:** Pan the camera anywhere across the office.
- **Mouse Wheel:** Zoom in and out smoothly.
- **Click Room Desk:** Camera centers on that specific room.

### C. Agent Inspector Panel (Right Drawer)
When an agent is selected, you can inspect and modify:
- **Live Status & Thought:** See their current mental state, thought bubble, and active task.
- **Provider Switcher:** Switch the agent's brain between **Mock (Simulation)**, **Gemini (Cloud AI)**, and **Antigravity (Local CLI/IDE)** on the fly.
- **Layered Memory:** View their 4-layer memory (Working, Task, Persistent, Semantic).
- **Available Tools:** View what tools they have permission to execute.
- **Direct Messaging:** Send a message directly from operator to agent.

### D. Human-in-the-Loop Approval Gate
When an agent attempts to run a **RESTRICTED** tool (such as `tool_restricted_deploy` or critical production modifications):
1. The agent halts immediately and transitions into `WAITING_APPROVAL`.
2. A banner appears in the **Operations Dashboard** under **Pending Human Approvals**.
3. You can click **Approve** or **Reject** (with reason). The agent will not proceed until authorized.

---

## 5. What Executes Under the Hood When You Give a Task?

When a task is submitted, the system activates a 7-stage enterprise pipeline:

```
[User Dispatches Task]
        │
        ▼
[1. Boss Orchestrator & TaskPlanner]
   • Validates acyclic graph structure (DAG)
   • Resolves upstream dependencies and assigns roles
        │
        ▼
[2. Enterprise Scheduler]
   • Checks Backpressure capacity (concurrency limits)
   • Enforces task timeouts (default 30s)
   • Injects correlation IDs for telemetry
        │
        ▼
[3. Agent Runtime Initialization]
   • ProviderRegistry resolves the active provider:
       ├─ Gemini Provider ───► Backend bridge calling @google/genai (Gemini 2.5)
       ├─ Antigravity Provider ─► Spawns `agy` CLI with `--model=gemini-3.8-flash-low`
       └─ Mock Provider ─────► Fast deterministic offline simulation
   • Assembles AgentContext (System prompt + Upstream deliverables + Layered memory)
        │
        ▼
[4. Deterministic State Progression]
   • Agent transitions: IDLE ➔ STARTING ➔ THINKING ➔ TOOL_EXECUTION ➔ COMPLETED
   • EventBus broadcasts to Canvas World (speech bubbles, animations) & SSE stream
        │
        ▼
[5. Tool Execution & Security Boundaries]
   • ToolExecutor verifies agent capability matches tool required capability
   • Enforces risk policy (SAFE / CONTROLLED / RESTRICTED)
   • Sandboxed: strictly blocks arbitrary shell execution or reading `.env`/`.git`
        │
        ▼
[6. Deliverable & Artifact Synthesis]
   • ArtifactManager generates immutable verifiable deliverables:
       ├─ Code artifacts (`code`)
       ├─ Security audit reports (`security_report`)
       ├─ Fuzzing & test suites (`test_report`)
       └─ Research dossiers (`research_note`)
   • Generates typed handoffs with flying envelope animation to dependent agents
        │
        ▼
[7. Persistence & Telemetry]
   • Records duration, token usage, tools used, and status in SQLite database (WAL mode)
   • Updates Telemetry metrics: throughput, error rate, p95 execution latency
```

---

## 6. How to Start Agent HQ Locally

1. **One-Click Launch:**
   Double-click `Agent-HQ.bat` in the project root.
   *(This launches both the backend bridge on port 3001 and the frontend UI on port 3005, then opens your browser automatically).*

2. **Manual Terminal Launch:**
   ```powershell
   # Terminal 1: Backend Server (Port 3001)
   npx tsx server/index.ts

   # Terminal 2: Frontend UI (Port 3005)
   npx vite --port=3005
   ```

3. **Optional Real AI Setup:**
   To enable real AI generation:
   - For **Gemini**: Add `GEMINI_API_KEY=your_key` to `.env`.
   - For **Antigravity**: Ensure the `agy` CLI is installed in your terminal PATH.
   - If keys are omitted, Agent HQ will seamlessly operate in high-speed, zero-dependency **Mock Simulation Mode**.
