import { TaskModel, TaskPriority, TaskStatus, TaskLogEntry } from '../types/index.ts';
import { INITIAL_TASKS } from '../data/initialTasks.ts';
import { EventBus } from '../events/EventBus.ts';
import { AgentManager } from '../agents/AgentManager.ts';
import { ApiClient } from '../services/ApiClient.ts';
import {
  TaskLifecycleStartedEvent,
  TaskLifecycleProgressEvent,
  TaskLifecycleCompletedEvent,
  TaskLifecycleFailedEvent,
  RuntimeToolCompletedEvent,
} from '../events/EventTypes.ts';
import { generateId } from '../utils/id.ts';

class TaskManagerClass {
  private tasks: Map<string, TaskModel> = new Map();
  private apiClient: ApiClient = ApiClient.getInstance();

  constructor() {
    this.init();
    this.setupExecutionListeners();
  }

  private init(): void {
    // 1. Initial fallback seeds
    INITIAL_TASKS.forEach((t) => this.tasks.set(t.id, { ...t }));

    // 2. Load from localStorage if available as temporary cache
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('agent_hq_tasks');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((t: TaskModel) => {
              if (t && typeof t === 'object' && t.id) {
                this.tasks.set(t.id, t);
              }
            });
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Load durable state from backend server
    this.loadFromServer();
  }

  public async loadFromServer(): Promise<void> {
    try {
      const serverTasks = await this.apiClient.getTasks();
      if (serverTasks && Array.isArray(serverTasks) && serverTasks.length > 0) {
        serverTasks.forEach((st: any) => {
          const existing = this.tasks.get(st.id);
            let parsedResult = st.result;
            if (typeof parsedResult === 'string') {
              try { parsedResult = JSON.parse(parsedResult); } catch {}
            }
            const mapped: TaskModel = {
              id: st.id,
              title: st.title,
              description: st.description || '',
              status: st.status === 'COMPLETED' ? 'COMPLETED' : st.status === 'RUNNING' ? 'IN_PROGRESS' : 'QUEUED',
              priority: st.priority || 'MEDIUM',
              assignedAgentId: st.assigned_agent_id || null,
              progress: st.status === 'COMPLETED' ? 100 : existing?.progress || 0,
              createdAt: st.created_at || Date.now(),
              startedAt: st.started_at,
              completedAt: st.completed_at,
              dependencies: st.dependencies || existing?.dependencies || [],
              logs: existing?.logs || [],
              result: parsedResult || existing?.result,
              executionMode: st.execution_mode || (parsedResult as any)?.executionMode || 'mock',
            };
            this.tasks.set(st.id, mapped);
        });
      }
    } catch {
      // Backend offline fallback handled gracefully
    }
  }

  private setupExecutionListeners(): void {
    EventBus.on('task.started', (ev) => {
      const e = ev as TaskLifecycleStartedEvent;
      const task = this.tasks.get(e.taskId);
      if (task) {
        task.status = 'IN_PROGRESS';
        if (!task.startedAt) task.startedAt = e.timestamp;
        this.addLog(task.id, task.assignedAgentId || 'system', 'Execution started in background', 'status');
        this.save();
        this.apiClient.updateTaskStatus(task.id, 'RUNNING');
      }
    });

    EventBus.on('task.progress', (ev) => {
      const e = ev as TaskLifecycleProgressEvent;
      const task = this.tasks.get(e.taskId);
      if (task) {
        task.progress = e.progress;
        this.save();
      }
    });

    EventBus.on('task.completed', (ev) => {
      const e = ev as TaskLifecycleCompletedEvent;
      const task = this.tasks.get(e.taskId);
      if (task) {
        task.status = 'COMPLETED';
        task.progress = 100;
        task.completedAt = e.timestamp;
        let res = e.result;
        if (typeof res === 'string') {
          try { res = JSON.parse(res); } catch {}
        }
        if (res) {
          task.result = res;
          if (res.executionMode) task.executionMode = res.executionMode;
        }
        this.addLog(task.id, task.assignedAgentId || 'system', `Task completed: ${res?.summary || 'Deliverables generated successfully'}`, 'status');
        this.save();
        this.apiClient.updateTaskStatus(task.id, 'COMPLETED', task.result, (e as any).executionMode || task.executionMode || 'mock');
      }
    });

    EventBus.on('task.failed', (ev) => {
      const e = ev as TaskLifecycleFailedEvent;
      const task = this.tasks.get(e.taskId);
      if (task) {
        task.status = 'BLOCKED';
        this.addLog(task.id, task.assignedAgentId || 'system', `Task failed: ${e.error || 'Execution blocked'}`, 'status');
        this.save();
        this.apiClient.updateTaskStatus(task.id, 'FAILED');
      }
    });

    // Record tool usage in task log
    EventBus.on('runtime.tool_completed', (ev) => {
      const e = ev as any;
      // Find agent's active task
      for (const task of this.tasks.values()) {
        if (task.assignedAgentId === e.agentId && task.status === 'IN_PROGRESS') {
          this.addLog(task.id, e.agentId, `Invoked tool: ${e.tool?.name || 'tool'} (${e.durationMs || 0}ms)`, 'tool');
          break;
        }
      }
    });
  }

  public getAll(): TaskModel[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getById(id: string): TaskModel | null {
    return this.tasks.get(id) || null;
  }

  public getByAgent(agentId: string): TaskModel[] {
    return this.getAll().filter((t) => t.assignedAgentId === agentId);
  }

  public getByAgentId(agentId: string): TaskModel[] {
    return this.getByAgent(agentId);
  }

  public getPending(): TaskModel[] {
    return this.getAll().filter((t) => t.status === 'QUEUED' || t.status === 'ASSIGNED');
  }

  public getInProgress(): TaskModel[] {
    return this.getAll().filter((t) => t.status === 'IN_PROGRESS');
  }

  public getCompleted(): TaskModel[] {
    return this.getAll().filter((t) => t.status === 'COMPLETED');
  }

  public createTask(data: {
    title: string;
    description: string;
    priority?: TaskPriority;
    assignedAgentId?: string;
    dependencies?: string[];
  }): TaskModel {
    const id = generateId('task');
    const task: TaskModel = {
      id,
      title: data.title,
      description: data.description,
      status: 'QUEUED',
      priority: data.priority || 'MEDIUM',
      assignedAgentId: data.assignedAgentId || null,
      progress: 0,
      createdAt: Date.now(),
      dependencies: data.dependencies || [],
      logs: [
        {
          id: generateId('log'),
          timestamp: Date.now(),
          agentId: 'system',
          message: `Task created with priority ${data.priority || 'MEDIUM'}`,
          type: 'info',
        },
      ],
    };

    this.tasks.set(task.id, task);
    this.save();

    // Persist to server in background
    this.apiClient.createTask({
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      assignedAgentId: task.assignedAgentId || undefined,
      dependencies: task.dependencies,
    });

    if (task.assignedAgentId) {
      AgentManager.assignTask(task.assignedAgentId, task.id);
    }

    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.task_assigned',
      timestamp: Date.now(),
      taskId: task.id,
      agentId: task.assignedAgentId || undefined,
      status: 'QUEUED',
      priority: task.priority,
      message: `Task "${task.title}" created${
        task.assignedAgentId ? ` and assigned to ${task.assignedAgentId}` : ''
      }.`,
    });

    return task;
  }

  public assignTask(taskId: string, agentId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.assignedAgentId = agentId;
    this.addLog(taskId, agentId, `Assigned to ${agentId}`, 'info');
    this.save();

    AgentManager.assignTask(agentId, taskId);

    EventBus.emit({
      id: generateId('ev'),
      type: 'agent.task_assigned',
      timestamp: Date.now(),
      taskId: task.id,
      agentId,
      status: task.status,
      priority: task.priority,
      message: `Task "${task.title}" assigned to ${agentId}.`,
    });

    return true;
  }

  public setTaskStatus(taskId: string, status: TaskStatus): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const prevStatus = task.status;
    task.status = status;

    if (status === 'IN_PROGRESS' && !task.startedAt) {
      task.startedAt = Date.now();
    } else if (status === 'COMPLETED') {
      task.completedAt = Date.now();
      task.progress = 100;
      if (task.assignedAgentId) {
        AgentManager.incrementStats(task.assignedAgentId, 'tasksCompleted');
      }
    }

    this.addLog(taskId, task.assignedAgentId || 'system', `Status changed: ${prevStatus} -> ${status}`, 'status');
    this.save();

    this.apiClient.updateTaskStatus(
      taskId,
      status === 'IN_PROGRESS' ? 'RUNNING' : status === 'COMPLETED' ? 'COMPLETED' : status
    );

    return true;
  }

  public addLog(taskId: string, agentId: string, message: string, type: TaskLogEntry['type'] = 'info'): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.logs.push({
      id: generateId('log'),
      timestamp: Date.now(),
      agentId,
      message,
      type,
    });
    this.save();
  }

  public updateStatus(taskId: string, status: TaskStatus, result?: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = status;
    let parsedResult = result;
    if (typeof parsedResult === 'string') {
      try { parsedResult = JSON.parse(parsedResult); } catch {}
    }

    if (status === 'IN_PROGRESS') {
      if (!task.startedAt) task.startedAt = Date.now();
      task.progress = Math.max(task.progress, 20);
      this.addLog(taskId, task.assignedAgentId || 'system', 'Execution started in background', 'status');
    } else if (status === 'COMPLETED') {
      task.completedAt = Date.now();
      task.progress = 100;
      if (parsedResult) {
        task.result = parsedResult;
        if (parsedResult.executionMode) task.executionMode = parsedResult.executionMode;
      }
      const summaryText = parsedResult?.summary || 'Deliverables generated successfully';
      this.addLog(taskId, task.assignedAgentId || 'system', `Task completed: ${summaryText}`, 'status');
    }
    this.save();
    EventBus.emit({
      id: generateId('ev'),
      type: status === 'IN_PROGRESS' ? 'task.started' : status === 'COMPLETED' ? 'task.completed' : 'task.progress',
      taskId,
      timestamp: Date.now(),
      status,
      result: task.result,
    } as any);
  }

  public reset(): void {
    this.tasks.clear();
    INITIAL_TASKS.forEach((t) => this.tasks.set(t.id, { ...t }));
    this.save();
  }

  public async clearAllTasks(): Promise<void> {
    this.tasks.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('agent_hq_tasks');
      }
      await fetch('/api/tasks', { method: 'DELETE' });
    } catch (e) {
      console.warn('[TaskManager] Error deleting server tasks:', e);
    }
    this.save();
    EventBus.emit({
      id: generateId('ev'),
      type: 'tasks.cleared' as any,
      timestamp: Date.now(),
      message: 'All tasks cleared',
    } as any);
  }

  private save(): void {
    try {
      localStorage.setItem('agent_hq_tasks', JSON.stringify(Array.from(this.tasks.values())));
    } catch {
      // ignore
    }
  }
}

export const TaskManager = new TaskManagerClass();
