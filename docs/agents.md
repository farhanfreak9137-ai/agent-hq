# Agent System & Runtime

## Agents
Agent HQ provisions specialized autonomous roles:
- **BOSS** (`Orchestrator`): Mission synthesis, task decomposition, workload balancing, deliverable approval.
- **NOVA** (`Coder`): Systems architecture, backend API implementations, concurrency synchronization.
- **ATLAS** (`Researcher`): Technology landscape benchmarking, CVE vulnerability indexing, knowledge retrieval.
- **PIXEL** (`Designer`): UI wireframing, color palette harmony, responsive spatial hierarchy.
- **ECHO** (`Reviewer`): Rigorous peer review, AST syntax analysis, memory leak detection.
- **VECTOR** (`Tester`): Chaos penetration fuzzing, integration regression matrices, latency profiling.
- **SENTINEL** (`Security Engineer`): Threat modeling, asymmetric cryptographic boundaries, zero-trust sign-off.

## Agent Context (`AgentContext`)
Constructed dynamically by `AgentContextBuilder` with token/entry limits:
- Identity & System Directive
- Upstream Dependency Deliverables
- Retrieved Relevant Memories (ranked by `RelevanceScorer`)
- Available Permitted Tools
- Recent Inter-Agent Comms
- Active Mission Topology

## Agent Availability States
Agents transition through deterministic states:
`IDLE` → `STARTING` → `THINKING` → `TOOL_EXECUTION` → `COMMUNICATING` → `WAITING` → `WAITING_APPROVAL` → `COMPLETED` → `ERROR` → `OFFLINE`.
