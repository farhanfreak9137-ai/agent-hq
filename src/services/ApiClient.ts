import { AgentModel, TaskModel, MessageModel, MemoryEntry } from '../types/index.ts';

const BASE_URL = typeof window !== 'undefined' ? '' : 'http://127.0.0.1:3001';

export interface SyncResponse {
  timestamp: number;
  agents: any[];
  activeMission: any | null;
  tasks: any[];
  recentMessages: any[];
  providers: any[];
}

export class ApiClient {
  private static instance: ApiClient | null = null;
  private isServerAvailable: boolean = true;
  private token: string | null = null;

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  public setToken(token: string | null): void {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  public async post<T>(endpoint: string, body: unknown): Promise<T | null> {
    return this.fetchJson<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public async get<T>(endpoint: string): Promise<T | null> {
    return this.fetchJson<T>(endpoint, {
      method: 'GET',
    });
  }

  private async fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // sends HttpOnly cookies automatically
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      this.isServerAvailable = true;
      return (await res.json()) as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('NetworkError')) {
        this.isServerAvailable = false;
      }
      return null;
    }
  }

  public isOnline(): boolean {
    return this.isServerAvailable;
  }

  // 1. Full State Synchronization
  public async sync(): Promise<SyncResponse | null> {
    return this.fetchJson<SyncResponse>('/api/sync');
  }

  // 2. Auth APIs
  public async login(username: string, password: string): Promise<any | null> {
    const res = await this.fetchJson<any>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res?.token) {
      this.token = res.token;
    }
    return res;
  }

  public async devLogin(role: 'ADMIN' | 'USER' = 'ADMIN'): Promise<any | null> {
    const res = await this.fetchJson<any>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    if (res?.token) {
      this.token = res.token;
    }
    return res;
  }

  public async logout(): Promise<boolean> {
    await this.fetchJson('/api/auth/logout', { method: 'POST' });
    this.token = null;
    return true;
  }

  public async getMe(): Promise<any | null> {
    return this.fetchJson('/api/auth/me');
  }

  // 3. Agents
  public async getAgents(): Promise<any[] | null> {
    return this.fetchJson<any[]>('/api/agents');
  }

  public async updateAgent(id: string, updates: Partial<AgentModel>): Promise<any | null> {
    return this.fetchJson(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // 4. Tasks
  public async getTasks(missionId?: string): Promise<any[] | null> {
    const query = missionId ? `?missionId=${encodeURIComponent(missionId)}` : '';
    return this.fetchJson<any[]>(`/api/tasks${query}`);
  }

  public async createTask(task: Partial<TaskModel> & { title: string }): Promise<any | null> {
    return this.fetchJson('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  public async updateTaskStatus(
    taskId: string,
    status: string,
    result?: any,
    executionMode?: 'real' | 'mock'
  ): Promise<any | null> {
    return this.fetchJson(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, result, executionMode }),
    });
  }

  public async executeTask(params: {
    taskId: string;
    agentId: string;
    agentName: string;
    role: string;
    title: string;
    description: string;
    capabilities: string[];
    providerId?: string;
  }): Promise<any | null> {
    return this.fetchJson('/api/tasks/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // 5. Missions / Initiatives
  public async createMission(initiative: {
    id: string;
    title: string;
    description?: string;
    nodes?: any[];
  }): Promise<any | null> {
    return this.fetchJson('/api/missions', {
      method: 'POST',
      body: JSON.stringify(initiative),
    });
  }

  public async cancelMission(missionId: string): Promise<any | null> {
    return this.fetchJson(`/api/missions/${missionId}/cancel`, {
      method: 'POST',
    });
  }

  // 6. Messages
  public async getMessages(agentId?: string): Promise<any[] | null> {
    const q = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
    return this.fetchJson<any[]>(`/api/messages${q}`);
  }

  public async sendMessage(msg: {
    id?: string;
    sourceAgentId: string;
    targetAgentId: string;
    content: string;
    type?: string;
    taskId?: string;
    payload?: any;
  }): Promise<any | null> {
    return this.fetchJson('/api/messages', {
      method: 'POST',
      body: JSON.stringify(msg),
    });
  }

  // 7. Memory
  public async getMemory(agentId: string, limit: number = 25): Promise<MemoryEntry[] | null> {
    return this.fetchJson<MemoryEntry[]>(`/api/memory/${agentId}?limit=${limit}`);
  }

  public async saveMemory(entry: Partial<MemoryEntry> & { agentId: string; content: string; type: string }): Promise<any | null> {
    return this.fetchJson('/api/memory', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  // 8. Providers
  public async getProviders(): Promise<any[] | null> {
    return this.fetchJson<any[]>('/api/providers');
  }
}
