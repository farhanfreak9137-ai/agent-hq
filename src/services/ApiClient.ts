import {
  AgentModel,
  TaskModel,
  MessageModel,
  MemoryEntry,
  ProfessionalProfile,
  ProfileSuggestion,
  Opportunity,
  JobApplication,
  OpportunityType,
  OpportunityStatus,
} from '../types/index.ts';

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

  // 9. Farhan Professional Profile
  public async getProfile(scope: string = 'FULL'): Promise<ProfessionalProfile | null> {
    return this.fetchJson<ProfessionalProfile>(`/api/profile?scope=${scope}`);
  }

  public async updateProfile(updates: Partial<ProfessionalProfile>): Promise<{ success: boolean; profile?: ProfessionalProfile } | null> {
    return this.fetchJson<{ success: boolean; profile?: ProfessionalProfile }>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  public async suggestProfileChange(suggestion: {
    agentId: string;
    reason: string;
    section: string;
    proposedChange: Record<string, unknown>;
  }): Promise<{ success: boolean; suggestion?: ProfileSuggestion } | null> {
    return this.fetchJson('/api/profile/suggest', {
      method: 'POST',
      body: JSON.stringify(suggestion),
    });
  }

  public async getProfileSuggestions(status?: string): Promise<ProfileSuggestion[] | null> {
    const q = status ? `?status=${status}` : '';
    return this.fetchJson<ProfileSuggestion[]>(`/api/profile/suggestions${q}`);
  }

  public async approveProfileSuggestion(id: string): Promise<any | null> {
    return this.fetchJson(`/api/profile/suggestions/${id}/approve`, {
      method: 'POST',
    });
  }

  public async rejectProfileSuggestion(id: string): Promise<any | null> {
    return this.fetchJson(`/api/profile/suggestions/${id}/reject`, {
      method: 'POST',
    });
  }

  // 10. Opportunity HQ
  public async getOpportunities(filter?: {
    type?: OpportunityType;
    status?: OpportunityStatus;
    remote?: boolean;
    limit?: number;
  }): Promise<Opportunity[] | null> {
    const params = new URLSearchParams();
    if (filter?.type) params.set('type', filter.type);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.remote !== undefined) params.set('remote', String(filter.remote));
    if (filter?.limit) params.set('limit', String(filter.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.fetchJson<Opportunity[]>(`/api/opportunities${qs}`);
  }

  public async getOpportunity(id: string): Promise<Opportunity | null> {
    return this.fetchJson<Opportunity>(`/api/opportunities/${id}`);
  }

  public async createOpportunity(opp: Partial<Opportunity>): Promise<Opportunity | null> {
    return this.fetchJson<Opportunity>('/api/opportunities', {
      method: 'POST',
      body: JSON.stringify(opp),
    });
  }

  public async updateOpportunity(id: string, updates: Partial<Opportunity>): Promise<Opportunity | null> {
    return this.fetchJson<Opportunity>(`/api/opportunities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  public async updateOpportunityStatus(id: string, status: OpportunityStatus, note?: string): Promise<any | null> {
    return this.fetchJson(`/api/opportunities/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    });
  }

  // 11. Tailored Applications
  public async getApplications(status?: string): Promise<JobApplication[] | null> {
    const q = status ? `?status=${status}` : '';
    return this.fetchJson<JobApplication[]>(`/api/applications${q}`);
  }

  public async getApplicationForOpportunity(oppId: string): Promise<JobApplication | null> {
    return this.fetchJson<JobApplication>(`/api/applications/opportunity/${oppId}`);
  }

  public async createApplication(app: Partial<JobApplication>): Promise<JobApplication | null> {
    return this.fetchJson<JobApplication>('/api/applications', {
      method: 'POST',
      body: JSON.stringify(app),
    });
  }

  public async approveApplication(id: string): Promise<any | null> {
    return this.fetchJson(`/api/applications/${id}/approve`, {
      method: 'POST',
    });
  }

  public async rejectApplication(id: string, reason: string): Promise<any | null> {
    return this.fetchJson(`/api/applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async submitApplication(id: string): Promise<{ success: boolean; message?: string; error?: string } | null> {
    return this.fetchJson<{ success: boolean; message?: string; error?: string }>(`/api/applications/${id}/submit`, {
      method: 'POST',
    });
  }
}

