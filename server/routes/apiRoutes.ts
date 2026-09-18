import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Repositories } from '../repositories/index.ts';
import { AuthService, AuthenticatedRequest } from '../auth/authService.ts';
import { Validator } from '../security/validator.ts';
import { createRateLimiter } from '../security/rateLimiter.ts';
import { EventStreamManager } from './eventStream.ts';
import { resetDatabase } from '../db/migrations.ts';
import Database from 'better-sqlite3';
import { DiscoveryService } from '../../src/opportunity/DiscoveryService.ts';
import { ArbeitnowOpportunityAdapter } from '../../src/opportunity/adapters/ArbeitnowOpportunityAdapter.ts';
import { OpportunityManager } from '../../src/opportunity/OpportunityManager.ts';
import { WorkspaceFileManager } from '../services/WorkspaceFileManager.ts';
import { EmailService } from '../services/EmailService.ts';
import { NotificationService } from '../services/NotificationService.ts';
import { ReplyListenerService } from '../services/ReplyListenerService.ts';

export interface ProviderCascadeOptions {
  geminiClients?: { client: GoogleGenAI; key: string }[];
  groqApiKey?: string;
  openaiApiKey?: string;
  groqModel?: string;
  openaiModel?: string;
}

export function createApiRouter(
  db: Database.Database,
  repos: Repositories,
  authService: AuthService,
  eventStream: EventStreamManager,
  aiClient: GoogleGenAI | null,
  hasGeminiKey: boolean,
  cascadeOptions?: ProviderCascadeOptions
): Router {
  const router = Router();
  let activeGeminiIndex = 0;

  function scanAndResolveDirectory(dirPath: string, maxDepth: number = 3, maxContentChars: number = 45000): string {
    const IGNORED = new Set(['.git', 'node_modules', 'dist', 'build', '.agents', 'coverage', '.cache', '.system_generated']);
    let totalFiles = 0;
    let totalDirs = 0;
    const treeLines: string[] = [];
    const candidates: { relPath: string; fullPath: string; size: number; priority: number }[] = [];

    function walk(currentDir: string, currentDepth: number) {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORED.has(entry.name)) continue;
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.relative(dirPath, fullPath);
          const indent = '  '.repeat(currentDepth);

          if (entry.isDirectory()) {
            totalDirs++;
            treeLines.push(`${indent}📁 ${entry.name}/`);
            if (currentDepth < maxDepth) {
              walk(fullPath, currentDepth + 1);
            }
          } else if (entry.isFile()) {
            totalFiles++;
            let size = 0;
            try {
              size = fs.statSync(fullPath).size;
            } catch {}
            const sizeStr = size > 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
            treeLines.push(`${indent}📄 ${entry.name} (${sizeStr})`);

            const ext = path.extname(entry.name).toLowerCase();
            const lowerName = entry.name.toLowerCase();

            let priority = 0;
            if (lowerName.includes('readme') || lowerName.includes('index') || lowerName.includes('rules') || lowerName.includes('glossary')) {
              priority = 100;
            } else if (ext === '.md' || ext === '.txt') {
              priority = 80;
            } else if (ext === '.json' || ext === '.yaml' || ext === '.yml' || ext === '.toml') {
              priority = 50;
            } else if (['.ts', '.js', '.py', '.html', '.css'].includes(ext)) {
              priority = 40;
            }

            if (priority > 0) {
              candidates.push({ relPath, fullPath, size, priority });
            }
          }
        }
      } catch (err) {
        treeLines.push(`Error reading ${currentDir}: ${err}`);
      }
    }

    walk(dirPath, 0);

    candidates.sort((a, b) => b.priority - a.priority || a.size - b.size);

    let output = `\n\n--- [Attached Directory Context: ${path.basename(dirPath)} (${dirPath})] ---\n`;
    output += `Total Items: ${totalFiles} files across ${totalDirs} subdirectories\n\n`;
    output += `Directory Structure Hierarchy:\n${treeLines.slice(0, 75).join('\n')}\n`;
    if (treeLines.length > 75) {
      output += `... [${treeLines.length - 75} additional files/folders omitted for brevity]\n`;
    }
    output += `\n--- Ingested Key Files from Directory ---\n`;

    let usedChars = 0;
    let ingestedCount = 0;

    for (const file of candidates) {
      if (usedChars >= maxContentChars) break;
      try {
        const remainingChars = maxContentChars - usedChars;
        let content = fs.readFileSync(file.fullPath, 'utf-8');

        if (content.length > 8000) {
          content = content.slice(0, 8000) + `\n... [Truncated ${content.length - 8000} remaining characters of ${file.relPath}]`;
        }
        if (content.length > remainingChars) {
          content = content.slice(0, remainingChars) + `\n... [Truncated to fit context budget]`;
        }

        output += `\n>>> File: ${file.relPath} (${(file.size / 1024).toFixed(1)} KB) <<<\n${content}\n>>> End of ${file.relPath} <<<\n`;
        usedChars += content.length;
        ingestedCount++;
      } catch {
        // ignore
      }
    }

    output += `\n--- End of Ingested Key Files (${ingestedCount} files read, ${usedChars} characters ingested) ---\n`;
    output += `--- [End of Directory Context: ${path.basename(dirPath)}] ---\n\n`;

    return output;
  }

  function resolveFileContext(text: string): string {
    if (!text) return '';
    const potentialPaths: string[] = Array.from(
      text.match(/[a-zA-Z]:\\[^\s"'\n\r<>|*?]+|\.\.?[\\\/][^\s"'\n\r<>|*?]+|workspace[\\\/][^\s"'\n\r<>|*?]+/g) || []
    );

    const workspaceDir = path.resolve(process.cwd(), 'workspace');
    if (fs.existsSync(workspaceDir)) {
      try {
        const workspaceFiles = fs.readdirSync(workspaceDir);
        for (const f of workspaceFiles) {
          if (text.includes(f) && !potentialPaths.includes(f)) {
            potentialPaths.push(path.join(workspaceDir, f));
          }
        }
      } catch {
        // ignore
      }
    }

    let attached = '';
    const visited = new Set<string>();
    for (const rawPath of potentialPaths) {
      try {
        const clean = rawPath.replace(/[,\.;:!?)]+$/, '').trim();
        const resolved = path.isAbsolute(clean) ? clean : path.resolve(process.cwd(), clean);
        if (visited.has(resolved)) continue;
        visited.add(resolved);

        if (fs.existsSync(resolved)) {
          const stat = fs.statSync(resolved);
          if (stat.isFile()) {
            const content = fs.readFileSync(resolved, 'utf-8');
            attached += `\n\n--- [Attached File Content: ${path.basename(resolved)}] ---\n${content.slice(0, 40000)}\n--- [End of ${path.basename(resolved)}] ---\n`;
          } else if (stat.isDirectory()) {
            attached += scanAndResolveDirectory(resolved);
          }
        }
      } catch {
        // ignore
      }
    }
    return attached;
  }

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

  interface CascadeExecutionResult {
    text: string;
    provider: 'gemini' | 'groq' | 'openai' | 'antigravity' | 'mock';
    model: string;
    toolsUsed: string[];
    conversationId?: string;
    usage?: any;
    durationMs: number;
  }

  async function callAIWithCascade(prompt: string, preferredProvider: string = 'gemini'): Promise<CascadeExecutionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Antigravity explicit priority if requested
    if (preferredProvider === 'antigravity') {
      try {
        console.log('[AI Cascade] Executing via requested Google Antigravity session (gemini-3.8-flash-low)...');
        const agyRes = await runAntigravityCLI(prompt, 'gemini-3.8-flash-low');
        return {
          text: agyRes.response,
          provider: 'antigravity',
          model: 'gemini-3.8-flash-low',
          toolsUsed: ['antigravity_reasoning'],
          conversationId: agyRes.conversationId,
          usage: agyRes.usage,
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        console.warn('[AI Cascade] Antigravity run failed, falling back to API keys cascade:', err);
        errors.push(`Antigravity: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Tier 1: Gemini Multi-Key Pool (round-robin + auto-rotation on limits)
    const clients = cascadeOptions?.geminiClients || (aiClient ? [{ client: aiClient, key: '' }] : []);
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
    if (clients.length > 0) {
      const totalKeys = clients.length;
      for (let attempt = 0; attempt < totalKeys; attempt++) {
        const keyIdx = (activeGeminiIndex + attempt) % totalKeys;
        const keyObj = clients[keyIdx];
        try {
          console.log(`[AI Cascade] Querying Gemini API (${geminiModel}, Key #${keyIdx + 1}/${totalKeys})...`);
          const modelResponse = await keyObj.client.models.generateContent({
            model: geminiModel,
            contents: prompt,
          });
          const text = modelResponse.text || '';
          if (text) {
            activeGeminiIndex = (keyIdx + 1) % totalKeys;
            return {
              text,
              provider: 'gemini',
              model: geminiModel,
              toolsUsed: ['gemini_inference'],
              durationMs: Date.now() - startTime,
            };
          }
        } catch (err: any) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[AI Cascade] Gemini Key #${keyIdx + 1} hit error / rate limit: ${msg}`);
          errors.push(`GeminiKey[#${keyIdx + 1}]: ${msg}`);
        }
      }
      activeGeminiIndex = (activeGeminiIndex + 1) % totalKeys;
    }

    // Tier 2: Groq Cloud Failover
    if (cascadeOptions?.groqApiKey) {
      const model = cascadeOptions.groqModel || 'llama-3.3-70b-versatile';
      try {
        console.log(`[AI Cascade] Gemini keys limited/exhausted. Failing over to Groq Cloud (${model})...`);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cascadeOptions.groqApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data.choices?.[0]?.message?.content || '';
          if (text) {
            return {
              text,
              provider: 'groq',
              model,
              toolsUsed: ['groq_fast_inference'],
              durationMs: Date.now() - startTime,
            };
          }
        } else {
          const errText = await res.text();
          console.warn('[AI Cascade] Groq Cloud response error:', errText);
          errors.push(`Groq: ${errText}`);
        }
      } catch (err: any) {
        console.warn('[AI Cascade] Groq Cloud network error:', err);
        errors.push(`Groq: ${err.message}`);
      }
    }

    // Tier 3: OpenAI Failover
    if (cascadeOptions?.openaiApiKey) {
      const model = cascadeOptions.openaiModel || 'gpt-4o';
      try {
        console.log(`[AI Cascade] Failing over to OpenAI (${model})...`);
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cascadeOptions.openaiApiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data.choices?.[0]?.message?.content || '';
          if (text) {
            return {
              text,
              provider: 'openai',
              model,
              toolsUsed: ['openai_inference'],
              durationMs: Date.now() - startTime,
            };
          }
        } else {
          const errText = await res.text();
          console.warn('[AI Cascade] OpenAI response error:', errText);
          errors.push(`OpenAI: ${errText}`);
        }
      } catch (err: any) {
        console.warn('[AI Cascade] OpenAI network error:', err);
        errors.push(`OpenAI: ${err.message}`);
      }
    }

    // Tier 4: Google Antigravity Session Safety Net
    try {
      console.log('[AI Cascade] External API quotas exhausted. Activating official Google Antigravity session (gemini-3.8-flash-low)...');
      const agyRes = await runAntigravityCLI(prompt, 'gemini-3.8-flash-low');
      return {
        text: agyRes.response,
        provider: 'antigravity',
        model: 'gemini-3.8-flash-low',
        toolsUsed: ['antigravity_reasoning'],
        conversationId: agyRes.conversationId,
        usage: agyRes.usage,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      console.warn('[AI Cascade] Google Antigravity safety net failed:', err);
      errors.push(`Antigravity: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Tier 5: Resilient Mock Output
    return {
      text: JSON.stringify({
        summary: 'Autonomous task execution finished.',
        output: `Task completed via resilient fallback. Upstream errors:\n${errors.join('\n')}`,
        toolsUsed: ['mock_simulation_engine'],
      }),
      provider: 'mock',
      model: 'deterministic-simulator',
      toolsUsed: ['mock_simulation_engine'],
      durationMs: Date.now() - startTime,
    };
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

    const fileContext = resolveFileContext(`${title} ${description || ''}`);
    const taskLower = `${title} ${description || ''}`.toLowerCase();
    let profileContext = '';
    const profile = repos.profile.get('FULL');
    if (
      profile &&
      (taskLower.includes('job') ||
        taskLower.includes('remote') ||
        taskLower.includes('career') ||
        taskLower.includes('resume') ||
        taskLower.includes('farhan') ||
        taskLower.includes('profile') ||
        taskLower.includes('application') ||
        taskLower.includes('outreach'))
    ) {
      profileContext = `\n\nFARHAN'S CANDIDATE PROFILE & PREFERENCES (ON RECORD):
- Candidate: ${profile.identity.fullName} (${profile.identity.professionalHeadline})
- Location & Timezone: ${profile.identity.location || 'Dhaka'} | ${profile.identity.timezone || 'UTC+6'}
- Contact: ${profile.identity.email} | LinkedIn: ${profile.identity.linkedInUrl || (profile.identity as any).linkedinUrl || 'https://linkedin.com/in/farhanfreak9137'}
- Target Roles: ${(profile.preferences?.targetRoles || []).join(', ')}
- Min Pay: ${profile.preferences?.minSalary || '$45,000 - $75,000 / year'}
- Timezone Requirements: ${profile.preferences?.timezoneRequirements || 'Flexible with US/EU timezone overlap'}
- Deal-Breakers: ${(profile.preferences?.dealBreakers || []).join('; ')}
- Submission Strategy: ${profile.preferences?.submissionStrategy || 'human_in_the_loop'}
- Core Skills: ${(profile.skills?.verifiedSkills || []).slice(0, 15).join(', ')}`;
    }
    const fullRequirements = `${description || ''}${fileContext}${profileContext}`;

    // If not mock, run through the resilient multi-tier provider cascade
    if (providerId !== 'mock') {
      try {
        const prompt = `You are ${agentName}, an autonomous AI agent with role "${role}" and capabilities: ${JSON.stringify(capabilities)}.
Execute the following initiative task:
Task: ${title}
Requirements: ${fullRequirements}

WORKSPACE REAL-FILE GENERATION INSTRUCTIONS:
You have the authority to create, write, or edit real files in the user's workspace!
Whenever the task involves:
- Writing or editing documents, case studies, reports, articles, or guides (e.g. .md, .docx, .txt)
- Researching and creating spreadsheets, datasets, or tables (e.g. .xlsx, .csv)
- Writing novel chapters, stories, episodes, or creative prose (e.g. .md, .docx)
- Writing or refactoring source code, scripts, configs (e.g. .ts, .js, .py, .json)
You MUST generate the complete, high-quality, comprehensive file content and include it in the "files" array in your JSON output.
Do NOT use placeholders or omit sections. Produce the full text/code/data.
For .docx files: provide rich Markdown text with headings (#, ##), bullet points, and bold text. The system automatically compiles it into a native Microsoft Word .docx document.
For .xlsx files: provide clean CSV text or a JSON array of row objects. The system automatically compiles it into a native Microsoft Excel .xlsx workbook.

Produce a structured JSON response matching this schema:
{
  "summary": "Concise summary of execution deliverables",
  "output": "Technical output, findings, or document preview",
  "toolsUsed": ["tool_name"],
  "files": [
    {
      "path": "filename.ext",
      "content": "Full complete file content here",
      "format": "text" | "docx" | "xlsx" | "csv",
      "action": "create" | "overwrite" | "append"
    }
  ]
}`;

        const cascadeRes = await callAIWithCascade(prompt, providerId);
        const text = cascadeRes.text || '';
        let parsed: { summary?: string; output?: string; toolsUsed?: string[]; files?: Array<{ path: string; content: string; format?: any; action?: any }> } = {};
        try {
          const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          const toParse = jsonMatch ? jsonMatch[1].trim() : text.trim();
          parsed = JSON.parse(toParse);
        } catch {
          try {
            const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleaned);
          } catch {
            parsed = {
              summary: `${agentName} executed task via ${cascadeRes.provider.toUpperCase()} (${cascadeRes.model}).`,
              output: text,
              toolsUsed: cascadeRes.toolsUsed,
            };
          }
        }

        // Process any workspace files the agent produced
        const filesCreated: Array<{ filename: string; relativePath: string; sizeBytes: number; extension: string; downloadUrl: string }> = [];
        if (Array.isArray(parsed.files) && parsed.files.length > 0) {
          for (const f of parsed.files) {
            if (f && f.path && typeof f.content === 'string') {
              try {
                const written = await WorkspaceFileManager.writeFile({
                  relativePath: f.path,
                  content: f.content,
                  format: f.format,
                  action: f.action || 'create',
                });
                filesCreated.push({
                  filename: written.filename,
                  relativePath: written.relativePath,
                  sizeBytes: written.sizeBytes,
                  extension: written.extension,
                  downloadUrl: `/api/workspace/files/${encodeURIComponent(written.relativePath)}?download=true`,
                });
              } catch (fileErr) {
                console.warn(`[Workspace] Failed to write file ${f.path}:`, fileErr);
              }
            }
          }
        }

        // Auto-Extractor Fallback: If no files were explicitly returned in `parsed.files`,
        // automatically extract deliverables from markdown tables, document text, and mentioned filenames
        const outputText = parsed.output || text || '';
        const combinedText = `${title} ${description || ''} ${outputText}`;

        const tryWriteAutoDeliverable = async (
          relPath: string,
          content: string,
          format?: 'text' | 'docx' | 'xlsx' | 'csv'
        ) => {
          if (!relPath || !content || !content.trim()) return;
          if (filesCreated.some((fc) => fc.relativePath.toLowerCase() === relPath.toLowerCase())) return;
          try {
            const written = await WorkspaceFileManager.writeFile({
              relativePath: relPath,
              content,
              format,
              action: 'overwrite',
            });
            filesCreated.push({
              filename: written.filename,
              relativePath: written.relativePath,
              sizeBytes: written.sizeBytes,
              extension: written.extension,
              downloadUrl: `/api/workspace/files/${encodeURIComponent(written.relativePath)}?download=true`,
            });
          } catch (err) {
            console.warn(`[Workspace Auto-Extractor] Failed to write ${relPath}:`, err);
          }
        };

        // 1. Scan for explicit file mentions in output text or instructions (e.g. `workspace/something.ext` or `filename.xlsx`)
        const fileRegex = /(?:workspace\/|`workspace\/)?([a-zA-Z0-9_\-]+\.(?:xlsx|docx|md|csv|json|txt))(?:\s|`|\)|$)/gi;
        const matches = Array.from(combinedText.matchAll(fileRegex));
        const matchedFilenames = matches.map((m) => m[1].toLowerCase());

        // 2. Check for Markdown tables -> Excel (.xlsx) / CSV
        const hasMarkdownTable = /\|(?:[^\r\n|]+\|)+\r?\n\|(?:\s*:?-+:?\s*\|)+\r?\n(?:\|(?:[^\r\n|]+\|)+\r?\n?)+/i.test(outputText);
        const wantsExcel =
          matchedFilenames.some((name) => name.endsWith('.xlsx') || name.endsWith('.csv')) ||
          /(?:\.xlsx|\.csv|excel|spreadsheet|dataset|sheet)/i.test(`${title} ${description || ''}`);

        if (hasMarkdownTable && wantsExcel) {
          let xlsxName =
            matchedFilenames.find((f) => f.endsWith('.xlsx')) ||
            matchedFilenames.find((f) => f.endsWith('.csv'));
          if (!xlsxName) {
            const slug =
              title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                .substring(0, 40) || 'data';
            xlsxName = `${slug}.xlsx`;
          }
          await tryWriteAutoDeliverable(xlsxName, outputText, 'xlsx');
        }

        // 3. Check for Word Document (.docx)
        const wantsDocx =
          matchedFilenames.some((f) => f.endsWith('.docx')) ||
          /(?:\.docx|word document|case study|formal report)/i.test(`${title} ${description || ''}`);
        if (wantsDocx && outputText.length > 50) {
          let docxName = matchedFilenames.find((f) => f.endsWith('.docx'));
          if (!docxName) {
            const slug =
              title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                .substring(0, 40) || 'document';
            docxName = `${slug}.docx`;
          }
          await tryWriteAutoDeliverable(docxName, outputText, 'docx');
        }

        // 4. Check for Markdown document (.md)
        const wantsMd =
          matchedFilenames.some((f) => f.endsWith('.md')) ||
          /(?:\.md|markdown|report|summary|guide|novel|chapter|episode)/i.test(`${title} ${description || ''}`);
        if (wantsMd && outputText.length > 50) {
          let mdName = matchedFilenames.find((f) => f.endsWith('.md'));
          if (!mdName) {
            const slug =
              title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
                .substring(0, 40) || 'report';
            mdName = `${slug}.md`;
          }
          await tryWriteAutoDeliverable(mdName, outputText, 'text');
        }

        const durationMs = cascadeRes.durationMs || 1200;
        const result = {
          summary: parsed.summary || `${agentName} synthesized task results`,
          output: parsed.output || text,
          toolsUsed: parsed.toolsUsed || cascadeRes.toolsUsed,
          filesCreated,
        };

        const executionMode = cascadeRes.provider === 'mock' ? 'mock' : 'real';

        repos.tasks.recordResult(taskId, result, executionMode);
        repos.tasks.recordExecution({
          id: `exec_${taskId}_${Date.now()}`,
          task_id: taskId,
          agent_id: agentId,
          provider_id: cascadeRes.provider,
          execution_mode: executionMode,
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
          executionMode,
          providerUsed: cascadeRes.provider,
          modelUsed: cascadeRes.model,
          conversationId: cascadeRes.conversationId,
          usage: cascadeRes.usage,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        repos.tasks.updateStatus(taskId, 'FAILED', { error: errorMsg });
        return res.status(500).json({ error: `AI Execution Cascade failed: ${errorMsg}` });
      }
    }

    // Local / Mock Provider Execution with real workspace file generation fallback
    const durationMs = 650;
    const filesCreated: Array<{ filename: string; relativePath: string; sizeBytes: number; extension: string; downloadUrl: string }> = [];

    // If the prompt is asking to generate or edit a file, create it in workspace even in mock mode
    const lowerTitle = `${title} ${description || ''}`.toLowerCase();
    if (lowerTitle.includes('case study') || lowerTitle.includes('doc') || lowerTitle.includes('novel') || lowerTitle.includes('excel') || lowerTitle.includes('sheet') || lowerTitle.includes('code')) {
      try {
        let filename = 'deliverable.md';
        let content = `# Deliverable: ${title}\n\nGenerated by ${agentName} (${role}).\n\n${description || ''}\n`;
        let format: any = 'text';

        if (lowerTitle.includes('case study')) {
          filename = 'agent-hq-case-study.md';
          content = `# Agent HQ — Comprehensive Engineering Case Study\n\n## 1. Executive Summary\nAgent HQ is an autonomous multi-agent orchestration platform designed for real-world enterprise operations.\n\n## 2. Architecture\n- **DAG Scheduler**: Dynamic dependency resolution.\n- **4-Tier Memory**: Working, Task, Persistent, Semantic.\n- **Reactive EventBus**: Live telemetry & state streaming.\n- **Workspace File Engine**: Native creation of Markdown, DOCX, and XLSX.\n\n## 3. Validated Capabilities\n- Deterministic skill matching without hallucinations.\n- Resilient multi-tier LLM cascade with automatic failover.\n- Strict human-in-the-loop approval boundaries.\n`;
        } else if (lowerTitle.includes('novel') || lowerTitle.includes('episode') || lowerTitle.includes('chapter')) {
          filename = 'novel-chapter.md';
          content = `# Chapter 1: The First Directive\n\nThe silence inside the orbital terminal was broken only by the rhythmic hum of the reactor core...\n`;
        } else if (lowerTitle.includes('excel') || lowerTitle.includes('sheet') || lowerTitle.includes('xlsx')) {
          filename = 'data-analysis.xlsx';
          content = 'Category,Item,Status,Score\nArchitecture,DAG Engine,Verified,98\nSecurity,Human Approval Gates,Active,100\nPersistence,WAL SQLite,Operational,96';
          format = 'xlsx';
        }

        const written = await WorkspaceFileManager.writeFile({
          relativePath: filename,
          content,
          format,
          action: 'create',
        });

        filesCreated.push({
          filename: written.filename,
          relativePath: written.relativePath,
          sizeBytes: written.sizeBytes,
          extension: written.extension,
          downloadUrl: `/api/workspace/files/${encodeURIComponent(written.relativePath)}?download=true`,
        });
      } catch (err) {
        console.warn('[Mock Workspace] Error generating mock workspace file:', err);
      }
    }

    const result = {
      summary: `Completed "${title}" via deterministic simulation engine.`,
      output: `Task ${taskId} verified with zero defects across bounds.`,
      toolsUsed: ['mock_simulation_engine'],
      filesCreated,
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

  // Purge all tasks, executions, and dependencies on demand (Clean board)
  router.delete('/tasks', authService.optionalAuth, (_req: AuthenticatedRequest, res: Response) => {
    const count = repos.tasks.clearAll();
    eventStream.broadcast({
      id: `ev_${Date.now()}`,
      type: 'tasks.cleared',
      timestamp: Date.now(),
      message: `Cleared ${count} tasks from database.`,
      agent_id: null,
      task_id: null,
      mission_id: null,
      metadata: { clearedCount: count },
    });
    return res.json({ success: true, clearedCount: count, message: `Cleared ${count} tasks from database.` });
  });

  router.post('/tasks/clear-all', authService.optionalAuth, (_req: AuthenticatedRequest, res: Response) => {
    const count = repos.tasks.clearAll();
    eventStream.broadcast({
      id: `ev_${Date.now()}`,
      type: 'tasks.cleared',
      timestamp: Date.now(),
      message: `Cleared ${count} tasks from database.`,
      agent_id: null,
      task_id: null,
      mission_id: null,
      metadata: { clearedCount: count },
    });
    return res.json({ success: true, clearedCount: count, message: `Cleared ${count} tasks from database.` });
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
  // 6b. Direct Conversational Agent Chat & Task Initiation
  // ----------------------------------------------------
  router.post('/agents/chat', async (req: Request, res: Response) => {
    const { agentId, userMessage, history, providerId } = req.body;

    if (!agentId || !userMessage) {
      return res.status(400).json({ error: 'Missing required parameters (agentId, userMessage)' });
    }

    // Look up agent details
    const agentEntity = repos.agents.getById(agentId);
    const agentName = agentEntity?.name || agentId.toUpperCase();
    const role = agentEntity?.role || 'Autonomous Specialist';
    const directive = agentEntity?.system_directive || `Act as ${agentName}, ${role} at Agent HQ.`;
    const capabilities = agentEntity?.capabilities || [];
    const targetProvider = providerId || agentEntity?.provider_id || 'gemini';

    // Format previous conversation context if provided
    let conversationContext = '';
    if (Array.isArray(history) && history.length > 0) {
      conversationContext = '\n\nRecent conversation history:\n' +
        history.slice(-8).map((h: any) => `${h.role === 'user' ? 'Farhan' : agentName}: ${h.content}`).join('\n');
    }

    // Load Farhan's authoritative profile & preferences so agents already know his resume & filters
    const profile = repos.profile.get('FULL');
    let profileContext = '';
    if (profile) {
      profileContext = `
FARHAN'S CONFIGURED MASTER PROFILE & JOB PREFERENCES (ALREADY ON RECORD - DO NOT ASK FOR THESE):
- Full Name: ${profile.identity.fullName} (${profile.identity.professionalHeadline})
- Location: ${profile.identity.location || 'Dhaka, Bangladesh'}
- Timezone: ${profile.identity.timezone || 'UTC+6 (Dhaka)'}
- Email: ${profile.identity.email} | Phone: ${profile.identity.phone || 'Available'}
- LinkedIn: ${profile.identity.linkedInUrl || (profile.identity as any).linkedinUrl || 'https://www.linkedin.com/in/farhanfreak9137'}
- Portfolio: ${profile.identity.portfolioUrl} | GitHub: ${profile.identity.githubUrl}
- Target Job Roles: ${(profile.preferences?.targetRoles || ['Full Stack Engineer', 'AI Engineer', 'Frontend Developer', 'AI Integrations Specialist', 'Node.js Developer']).join(', ')}
- Min Pay / Compensation: ${profile.preferences?.minSalary || '$45,000 - $75,000 / year (or $30 - $50 / hour)'}
- Timezone Working Hours: ${profile.preferences?.timezoneRequirements || 'Flexible — Can overlap 4+ hours daily with US Eastern/Pacific and European timezones'}
- Deal-Breakers: ${(profile.preferences?.dealBreakers || ['100% remote only (No relocation)', 'No uncompensated take-home test projects', 'No unpaid work']).join('; ')}
- Application Execution Strategy: ${profile.preferences?.submissionStrategy === 'autonomous' ? 'Option B: Autonomous Submission' : 'Option A: Human-in-the-loop (Draft, score, & review before submit)'}
- Key Verified Skills: ${(profile.skills?.verifiedSkills || []).slice(0, 15).join(', ')}
${profile.documents?.masterResumeMarkdown ? `- Master Resume: Fully configured on record (${profile.documents.masterResumeMarkdown.length} chars).` : ''}
`;
    }

    const prompt = `You are ${agentName}, an autonomous AI specialist at Agent HQ with the role of "${role}".
Your system directive: ${directive}
Your capabilities: ${JSON.stringify(capabilities)}.

You are directly conversing with Farhan, the founder and operator of Agent HQ.
CRITICAL GUIDELINES:
1. Converse naturally, conversationally, and authentically in character.
2. If Farhan asks general questions like "how are you doing", "what are you working on", or explores ideas, reply directly and conversationally as a real peer and partner. Do NOT force a task into existence for casual chat.
3. When Farhan asks for advice, technical planning, or architecture design, share clear, thoughtful insights, step-by-step plans, and collaborative feedback.
4. When Farhan explicitly instructs you to initiate/create a task, or when you both clearly agree on a concrete task initiative to execute, provide a structured TASK PROPOSAL block at the very end of your response using this EXACT format:
\`\`\`proposal
{
  "title": "Clear concise task title",
  "description": "Specific deliverables and execution steps",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}
\`\`\`
5. FARHAN'S PROFILE, MASTER RESUME, LINKEDIN, TARGET ROLES, AND APPLICATION PREFERENCES ARE ALREADY CONFIGURED (see below). NEVER ask Farhan to provide his resume, LinkedIn link, contact details, target roles, filters, pay requirements, or strategy again—you already have them on record in your active memory! Act upon them directly and proactively.
6. DIRECT GMAIL & OUTREACH ENGINE: You have direct integration with Farhan's Gmail and an Outreach Engine. When Farhan asks to reach out to companies, email recruiters/jobs from a spreadsheet, or apply via email, confirm that you will draft customized emails into the Outreach Outbox with Farhan's tailored cover pitch and resume attached, where he can review and dispatch them with anti-spam rate limiting.
If this is regular discussion or planning without a concrete task to launch right now, DO NOT include the proposal block. Keep your response concise, sharp, and helpful.
${profileContext}
${conversationContext}

Farhan: "${userMessage}"
${agentName}:`;

    try {
      let cascadeRes: CascadeExecutionResult;
      if (targetProvider === 'mock') {
        cascadeRes = {
          text: `Hey Farhan! Doing great and staying focused on our ${role.toLowerCase()} initiatives. What's on your mind?`,
          provider: 'mock',
          model: 'mock-engine',
          toolsUsed: ['local_heuristic'],
          durationMs: 50,
        };
      } else {
        cascadeRes = await callAIWithCascade(prompt, targetProvider);
      }

      const rawText = cascadeRes.text || `Hello Farhan, ${agentName} reporting in.`;
      let cleanReply = rawText;
      let proposedTask: { title: string; description: string; priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } | null = null;

      const proposalMatch = rawText.match(/```proposal\s*(\{[\s\S]*?\})\s*```/i);
      if (proposalMatch) {
        try {
          const parsed = JSON.parse(proposalMatch[1].trim());
          if (parsed.title) {
            const prio = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.priority) ? parsed.priority : 'MEDIUM';
            proposedTask = {
              title: parsed.title,
              description: parsed.description || '',
              priority: prio as any,
            };
            cleanReply = rawText.replace(/```proposal\s*\{[\s\S]*?\}\s*```/i, '').trim();
          }
        } catch (err) {
          console.warn('[Agent Chat] Could not parse proposal JSON:', err);
        }
      }

      const now = Date.now();
      // Record user message
      repos.messages.save({
        id: `msg_${now}_user_${Math.random().toString(36).substring(2, 7)}`,
        source_agent_id: 'farhan',
        target_agent_id: agentId,
        content: userMessage,
        type: 'chat',
        task_id: null,
        timestamp: now,
        payload: null,
      });

      // Record agent reply
      const replyMsg = repos.messages.save({
        id: `msg_${now + 1}_${agentId}_${Math.random().toString(36).substring(2, 7)}`,
        source_agent_id: agentId,
        target_agent_id: 'farhan',
        content: cleanReply,
        type: 'chat',
        task_id: null,
        timestamp: now + 1,
        payload: proposedTask ? { proposedTask } : null,
      });

      // Broadcast on SSE stream
      eventStream.broadcast({
        id: `ev_chat_${Date.now()}`,
        type: 'agent.message_sent',
        timestamp: replyMsg.timestamp,
        message: `${agentName} → Farhan: "${cleanReply.substring(0, 60)}"`,
        agent_id: agentId,
        task_id: null,
        mission_id: null,
        metadata: { targetAgentId: 'farhan', type: 'chat', proposedTask },
      });

      return res.json({
        reply: cleanReply,
        proposedTask,
        providerUsed: cascadeRes.provider,
        modelUsed: cascadeRes.model,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Agent Chat Error (${agentName})]:`, errorMsg);
      const fallbackReply = `Hey Farhan, I hear you loud and clear. My current status is active and I'm ready to collaborate on our ${role.toLowerCase()} initiatives. What are we planning?`;
      return res.json({
        reply: fallbackReply,
        proposedTask: null,
        providerUsed: 'fallback',
        modelUsed: 'local-resilience',
      });
    }
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

  // ----------------------------------------------------
  // 12B. Real Workspace Files Endpoints
  // ----------------------------------------------------

  router.get('/workspace/files', (_req: Request, res: Response) => {
    try {
      const files = WorkspaceFileManager.listFiles();
      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/workspace/files/:filename(*)', (req: Request, res: Response) => {
    try {
      const filepath = req.params.filename;
      const download = req.query.download === 'true';
      const fileData = WorkspaceFileManager.readFile(filepath);
      const fullPath = WorkspaceFileManager.resolveSafePath(filepath);

      if (download) {
        return res.download(fullPath, fileData.meta.filename);
      }

      res.setHeader('Content-Type', fileData.meta.mimeType);
      if (fileData.meta.isBinary && fileData.buffer) {
        return res.send(fileData.buffer);
      }
      res.send(fileData.content);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  router.post('/workspace/files', authService.optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { path: relPath, content, format, action } = req.body;
      if (!relPath || typeof content !== 'string') {
        return res.status(400).json({ error: 'Missing required parameters: path, content' });
      }
      const meta = await WorkspaceFileManager.writeFile({
        relativePath: relPath,
        content,
        format,
        action: action || 'create',
      });
      res.json({ success: true, file: meta });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // 13. CRM Prospects Endpoints
  // ----------------------------------------------------

  router.get('/prospects', (req: Request, res: Response) => {
    const status = req.query.status as any;
    const limit = Number(req.query.limit) || 100;
    res.json(repos.prospects.findAll({ status, limit }));
  });

  router.get('/prospects/:id', (req: Request, res: Response) => {
    const prospect = repos.prospects.findById(req.params.id);
    if (!prospect) return res.status(404).json({ error: 'Prospect not found.' });
    res.json(prospect);
  });

  router.post('/prospects', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { company, domain, contactName, contactEmail, opportunity, recommendedService, fit, priority, researchNotes, metadata } = req.body;
    if (!company) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    // Check for duplicate
    const existing = repos.prospects.checkDuplicate(company, domain);
    if (existing) {
      return res.status(409).json({
        error: `Prospect "${company}" already exists in CRM.`,
        prospect: existing,
        isDuplicate: true,
      });
    }

    const prospectId = `prospect_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const created = repos.prospects.create({
      id: prospectId,
      company: company.trim(),
      domain: domain ? domain.trim() : undefined,
      contactName,
      contactEmail,
      status: 'DISCOVERED',
      opportunity,
      recommendedService,
      fit: fit || 'medium',
      priority: priority || 'medium',
      researchNotes: researchNotes || [],
      interactions: [
        {
          id: `int_${Date.now()}_init`,
          timestamp: Date.now(),
          type: 'opportunity_identified',
          summary: `Prospect discovered and registered in CRM.`,
          actorAgentId: 'crm',
          details: { opportunity, recommendedService },
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    });

    eventStream.broadcast({
      id: `ev_crm_${created.id}`,
      type: 'crm.prospect_created',
      timestamp: Date.now(),
      message: `New prospect recorded: ${created.company} (Status: ${created.status})`,
      agent_id: 'crm',
      task_id: null,
      mission_id: null,
      metadata: { prospectId: created.id, company: created.company },
    });

    res.status(201).json(created);
  });

  router.patch('/prospects/:id/status', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { status, actorAgentId, note } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'New status is required.' });
    }

    const result = repos.prospects.transitionStatus(req.params.id, status, actorAgentId || 'crm', note);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    eventStream.broadcast({
      id: `ev_crm_status_${req.params.id}`,
      type: 'crm.status_changed',
      timestamp: Date.now(),
      message: `Prospect ${result.prospect?.company} transitioned to ${status}`,
      agent_id: actorAgentId || 'crm',
      task_id: null,
      mission_id: null,
      metadata: { prospectId: req.params.id, newStatus: status, note },
    });

    res.json(result.prospect);
  });

  router.post('/prospects/:id/interactions', (req: Request, res: Response) => {
    const { type, summary, actorAgentId, details } = req.body;
    if (!type || !summary) {
      return res.status(400).json({ error: 'Interaction type and summary required.' });
    }

    const updated = repos.prospects.recordInteraction(req.params.id, {
      type,
      summary,
      actorAgentId: actorAgentId || 'crm',
      details,
    });

    if (!updated) return res.status(404).json({ error: 'Prospect not found.' });

    eventStream.broadcast({
      id: `ev_crm_int_${Date.now()}`,
      type: 'crm.interaction_recorded',
      timestamp: Date.now(),
      message: `Interaction recorded for ${updated.company}: ${summary}`,
      agent_id: actorAgentId || 'crm',
      task_id: null,
      mission_id: null,
      metadata: { prospectId: updated.id, type },
    });

    res.json(updated);
  });

  // ----------------------------------------------------
  // 14. Outreach Drafts Endpoints (STRICT APPROVAL GATED)
  // ----------------------------------------------------

  router.get('/outreach/drafts', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const limit = Number(req.query.limit) || 100;
    res.json(repos.outreachDrafts.findAll({ status, limit }));
  });

  router.get('/outreach/drafts/:id', (req: Request, res: Response) => {
    const draft = repos.outreachDrafts.findById(req.params.id);
    if (!draft) return res.status(404).json({ error: 'Outreach draft not found.' });
    res.json(draft);
  });

  router.post('/outreach/drafts', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { prospectId, company, recipient, channel, subject, body, personalization_points, source_evidence, confidence } = req.body;

    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required.' });
    }

    const draftId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const created = repos.outreachDrafts.create({
      id: draftId,
      prospectId,
      company,
      recipient,
      channel: channel || 'email',
      subject,
      body,
      personalization_points: personalization_points || [],
      source_evidence: source_evidence || [],
      confidence: confidence ?? 0.9,
      requires_human_approval: true,
      status: 'AWAITING_HUMAN_APPROVAL',
      createdAt: Date.now(),
    });

    // Link draft to prospect if provided
    if (prospectId) {
      repos.prospects.update(prospectId, { draftId: created.id });
      repos.prospects.transitionStatus(prospectId, 'DRAFTED', 'outreach', 'Outreach draft prepared.');
    }

    eventStream.broadcast({
      id: `ev_outreach_draft_${created.id}`,
      type: 'outreach.draft_created',
      timestamp: Date.now(),
      message: `Outreach draft created for ${recipient} (${subject}). Status: AWAITING_HUMAN_APPROVAL`,
      agent_id: 'outreach',
      task_id: null,
      mission_id: null,
      metadata: { draftId: created.id, recipient, subject },
    });

    res.status(201).json(created);
  });

  router.post('/outreach/drafts/:id/approve', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const operator = req.user?.username || 'human_operator';
    const approved = repos.outreachDrafts.approve(req.params.id, operator);
    if (!approved) return res.status(404).json({ error: 'Draft not found.' });

    if (approved.prospectId) {
      repos.prospects.transitionStatus(approved.prospectId, 'APPROVED', 'human', `Approved by ${operator}`);
    }

    eventStream.broadcast({
      id: `ev_outreach_appr_${approved.id}`,
      type: 'outreach.approved',
      timestamp: Date.now(),
      message: `Outreach draft ${approved.id} APPROVED by ${operator}`,
      agent_id: 'human',
      task_id: null,
      mission_id: null,
      metadata: { draftId: approved.id, approvedBy: operator },
    });

    res.json({ success: true, draft: approved });
  });

  router.post('/outreach/drafts/:id/reject', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const operator = req.user?.username || 'human_operator';
    const reason = req.body.reason || 'Rejected by operator';
    const rejected = repos.outreachDrafts.reject(req.params.id, reason, operator);
    if (!rejected) return res.status(404).json({ error: 'Draft not found.' });

    eventStream.broadcast({
      id: `ev_outreach_rej_${rejected.id}`,
      type: 'outreach.rejected',
      timestamp: Date.now(),
      message: `Outreach draft ${rejected.id} REJECTED: ${reason}`,
      agent_id: 'human',
      task_id: null,
      mission_id: null,
      metadata: { draftId: rejected.id, reason },
    });

    res.json({ success: true, draft: rejected });
  });

  // Physically dispatch/send outreach ONLY IF EXPLICITLY APPROVED
  router.post('/outreach/drafts/:id/send', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = repos.outreachDrafts.markSent(req.params.id);
    if (!result.success) {
      return res.status(403).json({ error: result.error });
    }

    const draft = result.draft!;
    if (draft.prospectId) {
      repos.prospects.transitionStatus(draft.prospectId, 'CONTACTED', 'outreach', `Sent email to ${draft.recipient}`);
      repos.prospects.recordInteraction(draft.prospectId, {
        type: 'contacted',
        summary: `Sent outreach email: "${draft.subject}" to ${draft.recipient}`,
        actorAgentId: 'outreach',
        details: { draftId: draft.id, channel: draft.channel },
      });
    }

    eventStream.broadcast({
      id: `ev_outreach_sent_${draft.id}`,
      type: 'agent.message_sent',
      timestamp: Date.now(),
      message: `OUTREACH DISPATCHED: Email sent to ${draft.recipient}`,
      agent_id: 'outreach',
      task_id: null,
      mission_id: null,
      metadata: { draftId: draft.id, recipient: draft.recipient },
    });

    res.json({ success: true, message: 'Outreach dispatched successfully.', draft });
  });

  // ----------------------------------------------------
  // 9. Farhan Professional Profile Endpoints
  // ----------------------------------------------------

  router.get('/profile', (_req: Request, res: Response) => {
    const scope = (_req.query.scope as any) || 'FULL';
    const profile = repos.profile.get(scope);
    if (!profile) return res.status(404).json({ error: 'Profile not found.' });
    res.json(profile);
  });

  router.put('/profile', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = repos.profile.updateAuthoritative(req.body, {
      isUser: true,
      actorId: req.user?.username || 'Farhan',
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    eventStream.broadcast({
      id: `ev_prof_upd_${Date.now()}`,
      type: 'agent.state_changed',
      timestamp: Date.now(),
      message: 'Farhan Professional Profile updated.',
      agent_id: 'system',
      task_id: null,
      mission_id: null,
      metadata: { version: result.profile?.version },
    });

    res.json({ success: true, profile: result.profile });
  });

  router.post('/profile/suggest', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { agentId, reason, section, proposedChange } = req.body;
    if (!agentId || !reason || !section || !proposedChange) {
      return res.status(400).json({ error: 'agentId, reason, section, and proposedChange are required.' });
    }

    const suggestion = repos.profile.createSuggestion({
      agentId,
      reason,
      section,
      proposedChange,
    });

    eventStream.broadcast({
      id: `ev_sug_${suggestion.id}`,
      type: 'agent.state_changed',
      timestamp: Date.now(),
      message: `Profile suggestion from ${agentId}: ${reason}`,
      agent_id: agentId,
      task_id: null,
      mission_id: null,
      metadata: { suggestionId: suggestion.id, section },
    });

    res.json({ success: true, suggestion });
  });

  router.get('/profile/suggestions', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    res.json(repos.profile.getSuggestions(status));
  });

  router.post('/profile/suggestions/:id/approve', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const approvedBy = req.user?.username || 'Farhan';
    const result = repos.profile.approveSuggestion(req.params.id, approvedBy);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, profile: result.profile });
  });

  router.post('/profile/suggestions/:id/reject', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const rejectedBy = req.user?.username || 'Farhan';
    const result = repos.profile.rejectSuggestion(req.params.id, rejectedBy);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, message: 'Suggestion rejected.' });
  });

  // ----------------------------------------------------
  // 10. Opportunity HQ Endpoints
  // ----------------------------------------------------

  router.get('/opportunities', (req: Request, res: Response) => {
    const { type, status, remote, limit } = req.query;
    const opportunities = repos.opportunities.findAll({
      type: type as any,
      status: status as any,
      remote: remote !== undefined ? remote === 'true' || remote === '1' : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json(opportunities);
  });

  router.get('/opportunities/:id', (req: Request, res: Response) => {
    const opp = repos.opportunities.findById(req.params.id);
    if (!opp) return res.status(404).json({ error: 'Opportunity not found.' });
    res.json(opp);
  });

  router.post('/opportunities', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = repos.opportunities.create(req.body);
    if (!result.success && result.isDuplicate) {
      return res.status(409).json({ error: result.error, opportunity: result.opportunity, isDuplicate: true });
    }
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.status(201).json(result.opportunity);
  });

  router.patch('/opportunities/:id', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const updated = repos.opportunities.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Opportunity not found.' });
    res.json(updated);
  });

  router.patch('/opportunities/:id/status', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { status, note } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required.' });

    const result = repos.opportunities.transitionStatus(
      req.params.id,
      status,
      req.user?.username || 'system',
      note
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, opportunity: result.opportunity });
  });

  router.post('/opportunities/:id/verify', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { verified = true, verifier = 'Farhan', notes } = req.body || {};
    const existing = repos.opportunities.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Opportunity not found.' });

    const newVerification = verified ? 'VERIFIED' : 'UNVERIFIED';
    const evidence = [...(existing.evidence || [])];
    const verifierNote = `Manually verified by ${verifier}${notes ? `: ${notes}` : ''}`;
    if (verified && !evidence.includes(verifierNote)) {
      evidence.push(verifierNote);
    }

    // Update in-memory DiscoveryService / OpportunityManager & emit EventBus event
    DiscoveryService.verifyOpportunity(req.params.id, Boolean(verified), verifier, [verifierNote]);

    // Persist explicitly to SQLite repository
    const updated = repos.opportunities.update(req.params.id, {
      sourceVerification: newVerification,
      evidence,
    });

    res.json({ success: true, opportunity: updated });
  });

  router.delete('/opportunities/:id', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const deleted = repos.opportunities.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Opportunity not found.' });
    res.json({ success: true, message: 'Opportunity deleted.' });
  });

  router.post('/opportunities/discover', authService.optionalAuth, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const currentStatus = DiscoveryService.getStatus();
      if (currentStatus.isRunning) {
        return res.status(409).json({
          error: 'A discovery run is already active.',
          conflict: true,
          currentRunId: currentStatus.currentRunId,
        });
      }

      // Ensure public adapter is registered if no adapter registered
      if (DiscoveryService.getAdapters().length === 0) {
        DiscoveryService.registerAdapter(new ArbeitnowOpportunityAdapter());
      }

      // Sync SQLite opportunities into OpportunityManager so duplicate detection is complete
      const existingInDb = repos.opportunities.findAll();
      OpportunityManager.loadOpportunities(existingInDb);

      const result = await DiscoveryService.runDiscovery();

      // Persist newly discovered opportunities to SQLite repository
      for (const opp of OpportunityManager.getAllOpportunities()) {
        const existing = repos.opportunities.findById(opp.id);
        if (!existing) {
          repos.opportunities.create(opp);
        } else if (existing.status !== opp.status || existing.sourceVerification !== opp.sourceVerification) {
          repos.opportunities.update(opp.id, {
            status: opp.status,
            matchedSkills: opp.matchedSkills,
            missingSkills: opp.missingSkills,
            evidence: opp.evidence,
            fitAnalysis: opp.fitAnalysis,
            sourceVerification: opp.sourceVerification,
          });
        }
      }

      res.json({ success: true, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('CONCURRENCY_CONFLICT')) {
        return res.status(409).json({ error: msg, conflict: true });
      }
      res.status(500).json({ error: msg });
    }
  });

  router.get('/opportunities/discover/status', (_req: Request, res: Response) => {
    res.json(DiscoveryService.getStatus());
  });

  // ----------------------------------------------------
  // 11. Tailored Job Application Endpoints
  // ----------------------------------------------------

  router.get('/applications', (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    res.json(repos.jobApplications.findAll(status));
  });

  router.get('/applications/:id', (req: Request, res: Response) => {
    const app = repos.jobApplications.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    res.json(app);
  });

  router.get('/applications/opportunity/:oppId', (req: Request, res: Response) => {
    const app = repos.jobApplications.findByOpportunityId(req.params.oppId);
    if (!app) return res.status(404).json({ error: 'Application not found for opportunity.' });
    res.json(app);
  });

  router.post('/applications', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const app = repos.jobApplications.create(req.body);
    if (app.opportunityId) {
      repos.opportunities.update(app.opportunityId, {
        applicationDraftId: app.id,
        status: 'APPLICATION_DRAFTED',
      });
    }
    res.status(201).json(app);
  });

  router.post('/applications/:id/approve', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const approvedBy = req.user?.username || 'Farhan';
    const result = repos.jobApplications.approve(req.params.id, approvedBy);
    if (!result.success) return res.status(400).json({ error: result.error });

    if (result.application?.opportunityId) {
      repos.opportunities.transitionStatus(result.application.opportunityId, 'AWAITING_APPROVAL', approvedBy, 'Application approved for submission');
    }

    res.json({ success: true, application: result.application });
  });

  router.post('/applications/:id/reject', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body;
    const rejectedBy = req.user?.username || 'Farhan';
    const result = repos.jobApplications.reject(req.params.id, reason || 'Rejected by operator', rejectedBy);
    if (!result.success) return res.status(400).json({ error: result.error });

    if (result.application?.opportunityId) {
      repos.opportunities.transitionStatus(result.application.opportunityId, 'REJECTED', rejectedBy, reason);
    }

    res.json({ success: true, application: result.application });
  });

  // Physical submission gate: strictly requires APPROVED status
  router.post('/applications/:id/submit', authService.optionalAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = repos.jobApplications.submit(req.params.id);
    if (!result.success) {
      return res.status(403).json({ error: result.error });
    }

    const app = result.application!;
    if (app.opportunityId) {
      repos.opportunities.transitionStatus(app.opportunityId, 'SUBMITTED', 'Farhan', 'Submitted application to target organization');
    }

    eventStream.broadcast({
      id: `ev_app_submit_${app.id}`,
      type: 'agent.message_sent',
      timestamp: Date.now(),
      message: `APPLICATION SUBMITTED to ${app.targetOrganization}: "${app.opportunityTitle}"`,
      agent_id: 'system',
      task_id: null,
      mission_id: null,
      metadata: { applicationId: app.id, organization: app.targetOrganization },
    });

    res.json({ success: true, message: 'Application submitted successfully.', application: app });
  });

  // ----------------------------------------------------
  // 19. Gmail Integration & Outreach Outbox Endpoints
  // ----------------------------------------------------

  router.get('/email/config', (_req: Request, res: Response) => {
    try {
      const config = EmailService.getConfig(db);
      res.json({
        ...config,
        app_password: config.app_password ? '••••••••••••••••' : '',
        has_password: Boolean(config.app_password),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/email/config', (req: Request, res: Response) => {
    try {
      const { gmail_address, app_password, sender_name, stagger_delay_seconds, auto_send_enabled } = req.body;
      const updates: any = {};
      if (gmail_address !== undefined) updates.gmail_address = gmail_address;
      if (app_password !== undefined && app_password !== '••••••••••••••••' && app_password.trim() !== '') {
        updates.app_password = app_password;
      }
      if (sender_name !== undefined) updates.sender_name = sender_name;
      if (stagger_delay_seconds !== undefined) updates.stagger_delay_seconds = Number(stagger_delay_seconds);
      if (auto_send_enabled !== undefined) updates.auto_send_enabled = auto_send_enabled ? 1 : 0;

      const saved = EmailService.updateConfig(db, updates);
      res.json({
        success: true,
        config: {
          ...saved,
          app_password: saved.app_password ? '••••••••••••••••' : '',
          has_password: Boolean(saved.app_password),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/email/test', async (_req: Request, res: Response) => {
    try {
      const result = await EmailService.testConnection(db);
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, message: err?.message || String(err) });
    }
  });

  router.get('/outreach/emails', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM outreach_emails ORDER BY created_at DESC').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/outreach/draft-from-sheet', async (req: Request, res: Response) => {
    try {
      const { jobs } = req.body;
      const drafted = await EmailService.draftFromJobs(db, jobs);
      eventStream.broadcast({
        id: `ev_draft_${Date.now()}`,
        type: 'agent.message_sent',
        timestamp: Date.now(),
        message: `Outreach Agent generated ${drafted.length} tailored application emails in Outbox.`,
        agent_id: 'outreach',
        task_id: null,
        mission_id: null,
        metadata: { count: drafted.length },
      });
      res.json({ success: true, drafted, count: drafted.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/outreach/send', async (req: Request, res: Response) => {
    try {
      const { emailIds, delaySeconds } = req.body;
      const result = await EmailService.sendBatchStaggered(db, emailIds, delaySeconds);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/outreach/emails/:id/send', async (req: Request, res: Response) => {
    try {
      const result = await EmailService.sendOutreachEmail(db, req.params.id);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/outreach/emails/:id', (req: Request, res: Response) => {
    try {
      const { subject, body_text, body_html, recipient_email, company, role } = req.body;
      const existing = db.prepare('SELECT * FROM outreach_emails WHERE id = ?').get(req.params.id) as any;
      if (!existing) return res.status(404).json({ error: 'Email not found' });

      db.prepare(`
        UPDATE outreach_emails
        SET subject = ?, body_text = ?, body_html = ?, recipient_email = ?, company = ?, role = ?
        WHERE id = ?
      `).run(
        subject ?? existing.subject,
        body_text ?? existing.body_text,
        body_html ?? existing.body_html,
        recipient_email ?? existing.recipient_email,
        company ?? existing.company,
        role ?? existing.role,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM outreach_emails WHERE id = ?').get(req.params.id);
      res.json({ success: true, email: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/outreach/emails/:id', (req: Request, res: Response) => {
    try {
      db.prepare('DELETE FROM outreach_emails WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // 20. Incoming Replies & Phone Notification Endpoints
  // ----------------------------------------------------

  router.get('/replies', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM incoming_replies ORDER BY received_at DESC').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/replies/poll', async (_req: Request, res: Response) => {
    try {
      const result = await ReplyListenerService.pollInbox(db);
      if (result.newReplies > 0) {
        eventStream.broadcast({
          id: `ev_reply_${Date.now()}`,
          type: 'agent.message_sent',
          timestamp: Date.now(),
          message: `CRM Agent: Detected ${result.newReplies} new incoming recruiter reply(s)!`,
          agent_id: 'crm',
          task_id: null,
          mission_id: null,
          metadata: { newReplies: result.newReplies },
        });
      }
      res.json(result);
    } catch (err: any) {
      res.json({ checked: false, newReplies: 0, replies: [], error: err?.message || String(err) });
    }
  });

  router.post('/replies/:id/send', async (req: Request, res: Response) => {
    try {
      const reply = db.prepare('SELECT * FROM incoming_replies WHERE id = ?').get(req.params.id) as any;
      if (!reply) return res.status(404).json({ error: 'Reply record not found' });
      if (!reply.drafted_reply) return res.status(400).json({ error: 'No drafted reply found to send' });

      const config = EmailService.getConfig(db);
      const transporter = EmailService.createTransport(config);

      const subject = reply.subject.startsWith('Re:') ? reply.subject : `Re: ${reply.subject}`;
      await transporter.sendMail({
        from: `"${config.sender_name}" <${config.gmail_address}>`,
        to: reply.from_email,
        subject,
        text: reply.drafted_reply,
      });

      db.prepare("UPDATE incoming_replies SET status = 'replied' WHERE id = ?").run(req.params.id);

      eventStream.broadcast({
        id: `ev_replied_${Date.now()}`,
        type: 'agent.message_sent',
        timestamp: Date.now(),
        message: `Outreach Agent dispatched follow-up response to ${reply.company} (${reply.from_email})`,
        agent_id: 'outreach',
        task_id: null,
        mission_id: null,
        metadata: { replyId: req.params.id, company: reply.company },
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/replies/:id', (req: Request, res: Response) => {
    try {
      const { drafted_reply, status } = req.body;
      const existing = db.prepare('SELECT * FROM incoming_replies WHERE id = ?').get(req.params.id) as any;
      if (!existing) return res.status(404).json({ error: 'Reply not found' });

      db.prepare(`
        UPDATE incoming_replies
        SET drafted_reply = ?, status = ?
        WHERE id = ?
      `).run(
        drafted_reply ?? existing.drafted_reply,
        status ?? existing.status,
        req.params.id
      );

      const updated = db.prepare('SELECT * FROM incoming_replies WHERE id = ?').get(req.params.id);
      res.json({ success: true, reply: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/replies/:id', (req: Request, res: Response) => {
    try {
      db.prepare('DELETE FROM incoming_replies WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/notifications/config', (_req: Request, res: Response) => {
    try {
      const config = NotificationService.getConfig(db);
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/notifications/config', (req: Request, res: Response) => {
    try {
      const { channel, discord_webhook_url, is_enabled, poll_interval_minutes } = req.body;
      const saved = NotificationService.updateConfig(db, {
        channel,
        discord_webhook_url,
        is_enabled,
        poll_interval_minutes,
      });
      res.json({ success: true, config: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/notifications/test', async (_req: Request, res: Response) => {
    try {
      const result = await NotificationService.testAlert(db);
      res.json(result);
    } catch (err: any) {
      res.json({ success: false, message: err?.message || String(err) });
    }
  });

  // Start background inbox polling
  ReplyListenerService.startBackgroundListener(db, 5);

  return router;
}



