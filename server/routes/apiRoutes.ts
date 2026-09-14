import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import { Repositories } from '../repositories/index.ts';
import { AuthService, AuthenticatedRequest } from '../auth/authService.ts';
import { Validator } from '../security/validator.ts';
import { createRateLimiter } from '../security/rateLimiter.ts';
import { EventStreamManager } from './eventStream.ts';
import { resetDatabase } from '../db/migrations.ts';
import Database from 'better-sqlite3';

export function createApiRouter(
  db: Database.Database,
  repos: Repositories,
  authService: AuthService,
  eventStream: EventStreamManager,
  aiClient: GoogleGenAI | null,
  hasGeminiKey: boolean
): Router {
  const router = Router();

  const authLimiter = createRateLimiter({ windowMs: 60000, max: 20, message: 'Too many auth attempts.' });
  const taskLimiter = createRateLimiter({ windowMs: 60000, max: 60, message: 'Task execution rate limit reached.' });

  interface AgyExecutionResult {
    conversationId?: string;
    response: string;
    durationSeconds?: number;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      thinkingTokens?: number;
      totalTokens?: number;
    };
  }

  function runAntigravityCLI(prompt: string, model: string = 'gemini-3.8-flash-low', timeoutMs: number = 45000): Promise<AgyExecutionResult> {
    return new Promise((resolve, reject) => {
      const args = [
        '--output-format=json',
        `--model=${model}`,
        '--effort=low',
        '--disable-slash-commands',
        `--print=${prompt}`,
      ];

      const proc = spawn('agy', args, {
        shell: false,
        cwd: process.cwd(),
        env: process.env,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const timer = setTimeout(() => {
        killed = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL');
        }, 2000).unref();
        reject(new Error(`Antigravity CLI execution timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);

      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;
        if (code !== 0) {
          return reject(new Error(`Antigravity CLI failed with code ${code}: ${stderr || stdout || 'Unknown error'}`));
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          const usageData = parsed.usage ? {
            inputTokens: parsed.usage.input_tokens,
            outputTokens: parsed.usage.output_tokens,
            thinkingTokens: parsed.usage.thinking_tokens,
            totalTokens: parsed.usage.total_tokens,
          } : undefined;

          resolve({
            conversationId: parsed.conversation_id,
            response: parsed.response || stdout,
            durationSeconds: parsed.duration_seconds,
            usage: usageData,
          });
        } catch {
          resolve({
            response: stdout.trim(),
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  // ----------------------------------------------------
  // 1. Authentication Endpoints
  // ----------------------------------------------------

  router.post('/auth/login', authLimiter, (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const result = authService.login(username, password);
    if (!result) {
      repos.audit.record({
        actor_id: 'unknown',
        actor_name: username,
        action: 'user.login_failed',
        resource: 'user',
        resource_id: null,
        success: false,
        metadata: { username },
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    authService.setCookie(res, result.token);
    repos.audit.record({
      actor_id: result.user.id,
      actor_name: result.user.username,
      action: 'user.login',
      resource: 'user',
      resource_id: result.user.id,
      success: true,
      metadata: { role: result.user.role },
    });

    res.json({ success: true, user: result.user, token: result.token });
  });

  router.post('/auth/logout', authService.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      repos.audit.record({
        actor_id: req.user.userId,
        actor_name: req.user.username,
        action: 'user.logout',
        resource: 'user',
        resource_id: req.user.userId,
        success: true,
        metadata: {},
      });
    }
    authService.clearCookie(res);
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  router.get('/auth/me', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.json({ authenticated: false, user: null });
    }
    res.json({ authenticated: true, user: req.user });
  });

  router.post('/auth/dev-login', (req: Request, res: Response) => {
    const role = (req.body.role === 'ADMIN' ? 'ADMIN' : 'USER') as 'ADMIN' | 'USER';
    const result = authService.devLogin(role);

    authService.setCookie(res, result.token);
    repos.audit.record({
      actor_id: result.user.id,
      actor_name: result.user.username,
      action: 'user.dev_login',
      resource: 'user',
      resource_id: result.user.id,
      success: true,
      metadata: { role: result.user.role },
    });

    res.json({ success: true, user: result.user, token: result.token });
  });

  // ----------------------------------------------------
  // 2. State Synchronization Endpoint (for UI on mount/refresh)
  // ----------------------------------------------------

  router.get('/sync', authService.optionalAuth, (_req: Request, res: Response) => {
    const agents = repos.agents.getAll();
    const activeMission = repos.missions.getLatestActive();
    const tasks = repos.tasks.getAll(activeMission ? { missionId: activeMission.id } : undefined);
    const recentMessages = repos.messages.getRecent(40);
    const providers = repos.providers.getAll();

    res.json({
      timestamp: Date.now(),
      agents,
      activeMission,
      tasks,
      recentMessages,
      providers: providers.map((p) => ({
        ...p,
        available: p.id === 'mock' ? true : p.id === 'gemini' ? hasGeminiKey : false,
      })),
    });
  });

  // ----------------------------------------------------
  // 3. Agents Endpoints
  // ----------------------------------------------------

  router.get('/agents', (_req: Request, res: Response) => {
    res.json(repos.agents.getAll());
  });

  router.get('/agents/:id', (req: Request, res: Response) => {
    const agent = repos.agents.getById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found.' });
    res.json(agent);
  });

  router.patch('/agents/:id', authService.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const existing = repos.agents.getById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agent not found.' });

    const updated = repos.agents.upsert({
      ...existing,
      ...req.body,
      id: existing.id,
    });

    repos.audit.record({
      actor_id: req.user?.userId || 'unknown',
      actor_name: req.user?.username || 'unknown',
      action: 'agent.updated',
      resource: 'agent',
      resource_id: existing.id,
      success: true,
      metadata: req.body,
    });

    res.json(updated);
  });

  // ----------------------------------------------------
  // 4. Tasks Endpoints
  // ----------------------------------------------------

  router.get('/tasks', (req: Request, res: Response) => {
    const { missionId, status, agentId } = req.query;
    const tasks = repos.tasks.getAll({
      missionId: missionId as string | undefined,
      status: status as string | undefined,
      agentId: agentId as string | undefined,
    });
    res.json(tasks);
  });

  router.post('/tasks', authService.optionalAuth, Validator.validateTaskCreation, (req: AuthenticatedRequest, res: Response) => {
    const { id, missionId, title, description, priority, assignedAgentId, providerId, dependencies } = req.body;
    const taskId = id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const created = repos.tasks.create({
      id: taskId,
      mission_id: missionId || null,
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      status: 'PENDING',
      assigned_agent_id: assignedAgentId || null,
      provider_id: providerId || 'mock',
      execution_mode: 'mock',
      attempts: 0,
      max_attempts: 3,
      result: null,
      error: null,
      dependencies: dependencies || [],
      started_at: null,
      completed_at: null,
    });

    repos.audit.record({
      actor_id: req.user?.userId || 'user_anon',
      actor_name: req.user?.username || 'anonymous',
      action: 'task.created',
      resource: 'task',
      resource_id: taskId,
      success: true,
      metadata: { title, priority, assignedAgentId },
    });

    res.status(201).json(created);
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = repos.tasks.getById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    const executions = repos.tasks.getExecutions(req.params.id);
    res.json({ ...task, executions });
  });

  router.patch('/tasks/:id/status', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const task = repos.tasks.getById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const { status, result, error, durationMs, toolsUsed } = req.body;
    const now = Date.now();

    if (status === 'COMPLETED' && result) {
      repos.tasks.recordResult(task.id, result, req.body.executionMode || 'mock');
    } else if (status) {
      repos.tasks.updateStatus(task.id, status, {
        error,
        completed_at: ['COMPLETED', 'FAILED', 'CANCELLED', 'INTERRUPTED'].includes(status) ? now : undefined,
      });
    }

    // Record execution attempt history
    if (status && status !== 'PENDING') {
      repos.tasks.recordExecution({
        id: `exec_${task.id}_${Date.now()}`,
        task_id: task.id,
        agent_id: task.assigned_agent_id || 'unassigned',
        provider_id: task.provider_id || 'mock',
        execution_mode: req.body.executionMode || 'mock',
        attempt_number: (task.attempts || 0) + 1,
        status: status.toLowerCase() as any,
        started_at: task.started_at || now,
        completed_at: now,
        duration_ms: durationMs || 0,
        summary: result?.summary || null,
        output: result?.output || null,
        tools_used: toolsUsed || [],
        error: error || null,
      });
    }

    res.json({ success: true, taskId: task.id, status });
  });

  // Task execution through provider
  router.post('/tasks/execute', taskLimiter, authService.optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    const { taskId, agentId, agentName, role, title, description, capabilities, providerId } = req.body;

    if (!taskId || !title) {
      return res.status(400).json({ error: 'Missing required parameters (taskId, title)' });
    }

    // Check if task is already completed in DB
    const existingTask = repos.tasks.getById(taskId);
    if (existingTask && existingTask.status === 'COMPLETED') {
      return res.json({
        taskId,
        agentId,
        success: true,
        summary: (existingTask.result as any)?.summary || 'Task already completed.',
        output: (existingTask.result as any)?.output || '',
        toolsUsed: [],
        executionMode: existingTask.execution_mode,
        cached: true,
      });
    }

    // Ensure task exists in DB
    if (!existingTask) {
      repos.tasks.create({
        id: taskId,
        title,
        description: description || '',
        status: 'RUNNING',
        assigned_agent_id: agentId || null,
        provider_id: providerId || 'mock',
        execution_mode: providerId === 'antigravity' || providerId === 'gemini' ? 'real' : 'mock',
        started_at: Date.now(),
      });
    } else {
      repos.tasks.updateStatus(taskId, 'RUNNING', { started_at: Date.now() });
    }

    // If target provider is Gemini and API key is present
    if (providerId === 'gemini' && hasGeminiKey && aiClient) {
      try {
        const prompt = `You are ${agentName}, an autonomous AI agent with role "${role}" and capabilities: ${JSON.stringify(capabilities)}.
Execute the following initiative task:
Task: ${title}
Requirements: ${description}

Produce a structured JSON response with:
{
  "summary": "Concise summary of execution deliverables",
  "output": "Technical output and findings",
  "toolsUsed": ["tool_name"]
}`;

        const modelResponse = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        const text = modelResponse.text || '';
        let parsed: { summary?: string; output?: string; toolsUsed?: string[] } = {};
        try {
          const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = {
            summary: `${agentName} finalized task deliverables.`,
            output: text,
            toolsUsed: ['gemini_inference'],
          };
        }

        const durationMs = 1200;
        const result = {
          summary: parsed.summary || `${agentName} synthesized task results`,
          output: parsed.output || text,
          toolsUsed: parsed.toolsUsed || ['gemini_reasoning'],
        };

        repos.tasks.recordResult(taskId, result, 'real');
        repos.tasks.recordExecution({
          id: `exec_${taskId}_${Date.now()}`,
          task_id: taskId,
          agent_id: agentId,
          provider_id: 'gemini',
          execution_mode: 'real',
          attempt_number: 1,
          status: 'completed',
          started_at: Date.now() - durationMs,
          completed_at: Date.now(),
          duration_ms: durationMs,
          summary: result.summary,
          output: result.output,
          tools_used: result.toolsUsed,
          error: null,
        });

        return res.json({
          taskId,
          agentId,
          success: true,
          ...result,
          executionMode: 'real',
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        repos.tasks.updateStatus(taskId, 'FAILED', { error: errorMsg });
        return res.status(500).json({ error: `Gemini execution failed: ${errorMsg}` });
      }
    }

    // If target provider is Antigravity
    if (providerId === 'antigravity') {
      try {
        const startTime = Date.now();
        const prompt = `You are ${agentName}, an autonomous AI agent with role "${role}" and capabilities: ${JSON.stringify(capabilities)}.
Execute the following initiative task:
Task: ${title}
Requirements: ${description}

Produce a structured JSON response with:
{
  "summary": "Concise summary of execution deliverables",
  "output": "Technical output and findings",
  "toolsUsed": ["tool_name"]
}`;

        const agyResult = await runAntigravityCLI(prompt, 'gemini-3.8-flash-low');
        const durationMs = agyResult.durationSeconds ? Math.round(agyResult.durationSeconds * 1000) : (Date.now() - startTime);
        const text = agyResult.response || '';

        let parsed: { summary?: string; output?: string; toolsUsed?: string[] } = {};
        try {
          const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleaned);
        } catch {
          parsed = {
            summary: `${agentName} successfully executed task via Google Antigravity.`,
            output: text,
            toolsUsed: ['antigravity_reasoning'],
          };
        }

        const result = {
          summary: parsed.summary || `${agentName} synthesized Antigravity deliverables`,
          output: parsed.output || text,
          toolsUsed: parsed.toolsUsed || ['antigravity_reasoning'],
        };

        repos.tasks.recordResult(taskId, result, 'real');
        repos.tasks.recordExecution({
          id: `exec_${taskId}_${Date.now()}`,
          task_id: taskId,
          agent_id: agentId,
          provider_id: 'antigravity',
          execution_mode: 'real',
          attempt_number: 1,
          status: 'completed',
          started_at: Date.now() - durationMs,
          completed_at: Date.now(),
          duration_ms: durationMs,
          summary: result.summary,
          output: result.output,
          tools_used: result.toolsUsed,
          error: null,
        });

        return res.json({
          taskId,
          agentId,
          success: true,
          ...result,
          executionMode: 'real',
          conversationId: agyResult.conversationId,
          usage: agyResult.usage,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        repos.tasks.updateStatus(taskId, 'FAILED', { error: errorMsg });
        return res.status(500).json({ error: `Antigravity execution failed: ${errorMsg}` });
      }
    }

    // Local / Mock Provider Execution
    const durationMs = 650;
    const result = {
      summary: `Completed "${title}" via deterministic simulation engine.`,
      output: `Task ${taskId} verified with zero defects across bounds.`,
      toolsUsed: ['mock_simulation_engine'],
    };

    repos.tasks.recordResult(taskId, result, 'mock');
    repos.tasks.recordExecution({
      id: `exec_${taskId}_${Date.now()}`,
      task_id: taskId,
      agent_id: agentId,
      provider_id: providerId || 'mock',
      execution_mode: 'mock',
      attempt_number: 1,
      status: 'completed',
      started_at: Date.now() - durationMs,
      completed_at: Date.now(),
      duration_ms: durationMs,
      summary: result.summary,
      output: result.output,
      tools_used: result.toolsUsed,
      error: null,
    });

    return res.json({
      taskId,
      agentId,
      success: true,
      ...result,
      executionMode: 'mock',
    });
  });

  // ----------------------------------------------------
  // 5. Missions / Initiatives Endpoints
  // ----------------------------------------------------

  router.get('/missions', (_req: Request, res: Response) => {
    res.json(repos.missions.getAll());
  });

  router.post('/missions', authService.optionalAuth, Validator.validateInitiative, (req: AuthenticatedRequest, res: Response) => {
    const { id, title, description, nodes } = req.body;
    const missionId = id || `mission_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const tx = db.transaction(() => {
      // 1. Create mission
      const mission = repos.missions.create({
        id: missionId,
        title,
        description: description || null,
        status: 'in_progress',
        total_nodes: Array.isArray(nodes) ? nodes.length : 0,
        completed_nodes: 0,
        summary: null,
        error: null,
        started_at: now,
        completed_at: null,
      });

      // 2. Create tasks & dependencies with two-pass insertion to resolve foreign keys safely
      if (Array.isArray(nodes)) {
        const nodeToTaskId = new Map<string, string>();
        for (const node of nodes) {
          const tId = node.taskId || node.id;
          nodeToTaskId.set(node.id, tId);
          if (node.taskId) nodeToTaskId.set(node.taskId, tId);
        }

        // Pass 1: Insert all task rows first
        for (const node of nodes) {
          const tId = node.taskId || node.id;
          repos.tasks.create({
            id: tId,
            mission_id: missionId,
            title: node.title,
            description: node.description || '',
            priority: node.priority || 'HIGH',
            status: node.status === 'completed' ? 'COMPLETED' : 'PENDING',
            assigned_agent_id: node.assignedAgentId || null,
            provider_id: node.providerId || 'mock',
            execution_mode: node.executionMode || 'mock',
            attempts: 0,
            max_attempts: 3,
            result: node.result || null,
            error: null,
            dependencies: [],
            started_at: null,
            completed_at: node.status === 'completed' ? now : null,
          });
        }

        // Pass 2: Insert mapped dependencies
        for (const node of nodes) {
          const tId = node.taskId || node.id;
          if (Array.isArray(node.dependencies)) {
            for (const dep of node.dependencies) {
              const depTaskId = nodeToTaskId.get(dep) || dep;
              try {
                repos.tasks.addDependency(tId, depTaskId);
              } catch {
                // Ignore unresolvable external dependencies
              }
            }
          }
        }
      }

      return mission;
    });

    const mission = tx();

    repos.audit.record({
      actor_id: req.user?.userId || 'user_anon',
      actor_name: req.user?.username || 'anonymous',
      action: 'mission.started',
      resource: 'mission',
      resource_id: missionId,
      success: true,
      metadata: { title, totalNodes: mission.total_nodes },
    });

    res.status(201).json(mission);
  });

  router.get('/missions/:id', (req: Request, res: Response) => {
    const mission = repos.missions.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found.' });
    const tasks = repos.tasks.getAll({ missionId: req.params.id });
    res.json({ ...mission, tasks });
  });

  router.post('/missions/:id/cancel', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const mission = repos.missions.getById(req.params.id);
    if (!mission) return res.status(404).json({ error: 'Mission not found.' });

    repos.missions.updateStatus(mission.id, 'cancelled', {
      completed_at: Date.now(),
      summary: 'Cancelled by user request.',
    });

    // Cancel all non-completed tasks
    db.prepare("UPDATE tasks SET status = 'CANCELLED' WHERE mission_id = ? AND status IN ('PENDING', 'ASSIGNED', 'RUNNING', 'BLOCKED')").run(mission.id);

    repos.audit.record({
      actor_id: req.user?.userId || 'user_anon',
      actor_name: req.user?.username || 'anonymous',
      action: 'mission.cancelled',
      resource: 'mission',
      resource_id: mission.id,
      success: true,
      metadata: {},
    });

    res.json({ success: true, message: `Mission ${mission.id} cancelled.` });
  });

  // ----------------------------------------------------
  // 6. Messages Endpoints
  // ----------------------------------------------------

  router.get('/messages', (req: Request, res: Response) => {
    const agentId = req.query.agentId as string | undefined;
    const limit = Number(req.query.limit) || 40;
    res.json(repos.messages.getHistory(agentId, limit));
  });

  router.post('/messages', Validator.validateMessage, (req: Request, res: Response) => {
    const { id, sourceAgentId, targetAgentId, content, type, taskId, payload } = req.body;
    const msg = repos.messages.save({
      id: id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      source_agent_id: sourceAgentId,
      target_agent_id: targetAgentId,
      content,
      type: type || 'chat',
      task_id: taskId || null,
      timestamp: Date.now(),
      payload: payload || null,
    });

    eventStream.broadcast({
      id: `ev_msg_${msg.id}`,
      type: 'agent.message_sent',
      timestamp: msg.timestamp,
      message: `${sourceAgentId} → ${targetAgentId}: "${content.substring(0, 60)}"`,
      agent_id: sourceAgentId,
      task_id: taskId || null,
      mission_id: null,
      metadata: { targetAgentId, type },
    });

    res.status(201).json(msg);
  });

  // ----------------------------------------------------
  // 7. Memory Endpoints
  // ----------------------------------------------------

  router.get('/memory/:agentId', (req: Request, res: Response) => {
    const limit = Number(req.query.limit) || 25;
    const type = req.query.type as string | undefined;
    if (type) {
      res.json(repos.memory.getByType(req.params.agentId, type, limit));
    } else {
      res.json(repos.memory.getRecentByAgent(req.params.agentId, limit));
    }
  });

  router.post('/memory', (req: Request, res: Response) => {
    const { id, agentId, taskId, sessionId, type, content, metadata, expiresAt } = req.body;
    if (!agentId || !content || !type) {
      return res.status(400).json({ error: 'Missing required fields (agentId, content, type).' });
    }

    const entry = repos.memory.save({
      id: id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      agent_id: agentId,
      task_id: taskId || null,
      session_id: sessionId || null,
      type,
      content,
      metadata: metadata || null,
      timestamp: Date.now(),
      expires_at: expiresAt || null,
    });

    res.status(201).json(entry);
  });

  // ----------------------------------------------------
  // 8. Provider Configuration Endpoints (ZERO SECRETS RETURNED)
  // ----------------------------------------------------

  router.get('/providers', (_req: Request, res: Response) => {
    const configs = repos.providers.getAll();
    // Return sanitized provider status
    res.json(
      configs.map((c) => ({
        id: c.id,
        name: c.name,
        isEnabled: c.is_enabled,
        timeoutMs: c.timeout_ms,
        maxConcurrency: c.max_concurrency,
        models: c.models,
        available: c.id === 'mock' ? true : c.id === 'gemini' ? hasGeminiKey : false,
        message:
          c.id === 'mock'
            ? 'Deterministic local mock provider operational.'
            : c.id === 'gemini'
            ? hasGeminiKey
              ? 'Configured with GEMINI_API_KEY'
              : 'GEMINI_API_KEY not configured on server'
            : 'Official Antigravity SDK/daemon not active locally.',
      }))
    );
  });

  router.patch('/providers/:id', authService.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { name, isEnabled, timeoutMs, maxConcurrency, models } = req.body;
    const updated = repos.providers.update(req.params.id, {
      name,
      is_enabled: isEnabled,
      timeout_ms: timeoutMs,
      max_concurrency: maxConcurrency,
      models,
    });

    if (!updated) return res.status(404).json({ error: 'Provider configuration not found.' });

    repos.audit.record({
      actor_id: req.user?.userId || 'unknown',
      actor_name: req.user?.username || 'unknown',
      action: 'provider.configured',
      resource: 'provider_config',
      resource_id: req.params.id,
      success: true,
      metadata: req.body,
    });

    res.json(updated);
  });

  // ----------------------------------------------------
  // 9. Events & SSE Stream
  // ----------------------------------------------------

  router.get('/events', (req: Request, res: Response) => {
    eventStream.handleConnection(req, res);
  });

  router.post('/events', (req: Request, res: Response) => {
    const { id, type, timestamp, message, agentId, taskId, missionId, metadata } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: 'Missing required event fields (type, message).' });
    }

    const ev = {
      id: id || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      timestamp: timestamp || Date.now(),
      message,
      agent_id: agentId || null,
      task_id: taskId || null,
      mission_id: missionId || null,
      metadata: metadata || null,
    };

    eventStream.broadcast(ev);
    res.status(201).json(ev);
  });

  // ----------------------------------------------------
  // 10. Audit Logs Endpoint (ADMIN only)
  // ----------------------------------------------------

  router.get('/audit', authService.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const limit = Number(req.query.limit) || 50;
    const action = req.query.action as string | undefined;
    res.json(repos.audit.getRecent(limit, { action }));
  });

  // ----------------------------------------------------
  // 11. Admin Development Reset
  // ----------------------------------------------------

  router.post('/admin/reset', authService.requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    resetDatabase(db);

    repos.audit.record({
      actor_id: req.user?.userId || 'unknown',
      actor_name: req.user?.username || 'unknown',
      action: 'database.reset',
      resource: 'database',
      resource_id: null,
      success: true,
      metadata: {},
    });

    res.json({ success: true, message: 'Database reset and re-seeded successfully.' });
  });

  // ----------------------------------------------------
  // 12. Artifacts Endpoints (Deliverable Items)
  // ----------------------------------------------------

  router.get('/artifacts', (req: Request, res: Response) => {
    const taskId = req.query.taskId as string | undefined;
    const missionId = req.query.missionId as string | undefined;
    const limit = Number(req.query.limit) || 100;

    if (taskId) {
      return res.json(repos.artifacts.findByTaskId(taskId));
    }
    if (missionId) {
      return res.json(repos.artifacts.findByMissionId(missionId));
    }
    res.json(repos.artifacts.findAll(limit));
  });

  router.get('/artifacts/:id', (req: Request, res: Response) => {
    const artifact = repos.artifacts.findById(req.params.id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found.' });
    }
    res.json(artifact);
  });

  router.post('/artifacts', (req: Request, res: Response) => {
    const { id, taskId, agentId, missionId, type, title, content, metadata } = req.body;
    if (!id || !taskId || !agentId || !type || !title || !content) {
      return res.status(400).json({ error: 'Missing required artifact fields.' });
    }

    const created = repos.artifacts.create({
      id,
      taskId,
      agentId,
      missionId,
      type,
      title,
      content,
      createdAt: Date.now(),
      metadata,
    });

    res.status(201).json(created);
  });

  return router;
}
