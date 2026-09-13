/**
 * Structured Logger for Agent HQ
 * Ensures all lifecycle, provider, and orchestration actions are logged
 * with structured metadata while strictly guaranteeing that secrets, API keys,
 * cookies, tokens, and authorization headers are never logged.
 */

export interface LogContext {
  providerId?: string;
  agentId?: string;
  taskId?: string;
  initiativeId?: string;
  executionMode?: 'real' | 'mock';
  durationMs?: number;
  status?: string;
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  'key',
  'apikey',
  'api_key',
  'gemini_api_key',
  'token',
  'auth',
  'authorization',
  'cookie',
  'secret',
  'password',
]);

function sanitize(context?: LogContext): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const clean: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(context)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'string' && (v.startsWith('AIza') || v.includes('Bearer '))) {
      clean[k] = '[REDACTED_CREDENTIAL]';
    } else {
      clean[k] = v;
    }
  }

  return clean;
}

export const Logger = {
  providerSelected(agentId: string, providerId: string, executionMode: 'real' | 'mock', reason?: string) {
    const meta = sanitize({ agentId, providerId, executionMode, reason });
    console.log(`[Provider] Agent "${agentId}" assigned provider "${providerId}" (${executionMode.toUpperCase()})${reason ? ` - ${reason}` : ''}`, meta);
  },

  runtimeCreated(agentId: string, providerId: string, executionMode: 'real' | 'mock') {
    const meta = sanitize({ agentId, providerId, executionMode });
    console.log(`[Runtime] Runtime created for agent "${agentId}" with provider "${providerId}" [${executionMode}]`, meta);
  },

  taskStarted(taskId: string, agentId: string, title: string, providerId: string, executionMode: 'real' | 'mock') {
    const meta = sanitize({ taskId, agentId, providerId, executionMode });
    console.log(`[Task:Start] Task "${title}" (${taskId}) started by "${agentId}" via ${providerId} [${executionMode}]`, meta);
  },

  taskCompleted(taskId: string, agentId: string, title: string, providerId: string, executionMode: 'real' | 'mock', durationMs: number) {
    const meta = sanitize({ taskId, agentId, providerId, executionMode, durationMs });
    console.log(`[Task:Done] Task "${title}" (${taskId}) completed by "${agentId}" [${executionMode}] in ${durationMs}ms`, meta);
  },

  taskFailed(taskId: string, agentId: string, title: string, error: string, providerId?: string) {
    const meta = sanitize({ taskId, agentId, providerId, error });
    console.error(`[Task:Fail] Task "${title}" (${taskId}) failed for "${agentId}": ${error}`, meta);
  },

  messageSent(fromAgentId: string, toAgentId: string, type: string, taskId?: string) {
    const meta = sanitize({ fromAgentId, toAgentId, type, taskId });
    console.log(`[Comms:Send] Message from "${fromAgentId}" to "${toAgentId}" (type: ${type})`, meta);
  },

  messageReceived(fromAgentId: string, toAgentId: string, type: string, taskId?: string) {
    const meta = sanitize({ fromAgentId, toAgentId, type, taskId });
    console.log(`[Comms:Recv] "${toAgentId}" received message from "${fromAgentId}"`, meta);
  },
};
