# Observability, Telemetry & Correlation

## Telemetry Metrics (`TelemetryService`)
- **Latency Tracking**: Task latency, tool execution duration, provider response time.
- **Rates**: Success rate, failure rate, retry rate.
- **Capacity**: Active concurrency, scheduler queue depth.
- **Agent Stats**: Tasks completed, tasks failed, avg latency, tool usage breakdown, review cycles.
- **Mission Stats**: Total tasks, completed, failed, blocked, running, avg duration, parallelism factor.

## Correlation IDs
Every event and log entry carries an end-to-end trace:
$$\text{Mission ID} \longrightarrow \text{Task ID} \longrightarrow \text{Execution ID} \longrightarrow \text{Message ID}$$

Enables developers to trace any deliverable back through its exact tool calls, thoughts, and agent communications.
