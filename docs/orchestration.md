# Orchestration & DAG Scheduling

## TaskGraph & TaskPlanner
- Validates that task graphs are strictly acyclic (DAG).
- Supports dynamic task expansion, reusable mission templates, and competing solution evaluations.
- Unblocks child dependencies only when all parent nodes report `completed`.

## Scheduler
- Enforces strict concurrency limits (`maxConcurrentTasks`).
- **Cooperative Cancellation**: Deep propagation via `AbortSignal` across Mission → TaskGraph → Scheduler → Runtime → Tools.
- **Smart Retries**: Error classification (`transient`, `permanent`, `provider_unavailable`, `validation_error`, `tool_failure`, `timeout`) with exponential backoff. Permanent errors are failed immediately without wasted retries.
- **Backpressure**: Prevents system saturation via global queue limits, per-agent concurrency caps, and provider rate bounds.

## Review Loops & Infinite-Loop Prevention
- Peer review loops (Author → Reviewer → Feedback → Revision → Reviewer) are bounded by `maxCycles` (default 2).
- When `cycle >= maxCycles`, status transitions to `EXCEEDED_MAX_CYCLES` and escalates to BOSS.
