# Agent HQ Architecture

Agent HQ is a production-grade multi-agent operating system coupled to a live 2D Canvas office visualization.

```
USER
 ↓
API / UI (React + Tailwind CSS)
 ↓
BOSS ORCHESTRATOR
 ↓
TASK PLANNER
 ↓
TASK GRAPH (Directed Acyclic Graph)
 ↓
SCHEDULER (Concurrency, Retries, Backpressure)
 ↓
AGENT MANAGER
 ↓
AGENT RUNTIME (Context Builder, Layered Memory, Tools)
 ↓
PROVIDER ROUTER (Gemini, Antigravity, Mock)
 ↓
TOOLS / MEMORY / MESSAGES / ARTIFACTS
 ↓
EVENT BUS (Strongly Typed Pub/Sub)
 ├── UI & DASHBOARDS
 └── 2D OFFICE WORLD (Spatial Culling, HTML5 Canvas)
```

## Core Architectural Invariants
1. **Source of Truth**: The Agent Runtime and Scheduler serve as the source of truth for all work. The Canvas world purely renders and derives state from runtime models.
2. **Zero Leaks & Zero Malicious Execution**: No arbitrary shell execution, no destructive filesystem calls, no credentials stored in client code or database.
3. **Layered Memory & Bounded Context**: Strict token budgeting prevents model context overflow; 4-layer memory (working, task, persistent, semantic) scores items with temporal decay.
4. **Verifiable Deliverables**: Every task produces structured deliverables recorded as immutable artifacts.
5. **Human Approval Boundary**: All RESTRICTED tools trigger asynchronous human approval gates.
