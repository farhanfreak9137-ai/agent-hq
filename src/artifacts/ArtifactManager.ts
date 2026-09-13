import { Artifact, ArtifactType } from '../types/index.ts';
import { generateId } from '../utils/id.ts';
import { EventBus } from '../events/EventBus.ts';
import { ApiClient } from '../services/ApiClient.ts';

export interface CreateArtifactOptions {
  taskId: string;
  agentId: string;
  missionId?: string;
  type: ArtifactType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * ArtifactManager manages verifiable deliverable items produced by agents
 * (code snippets, audit certificates, architecture blueprints, test reports, research notes).
 */
export class ArtifactManager {
  private static instance: ArtifactManager | null = null;
  private artifacts: Map<string, Artifact> = new Map();
  private apiClient: ApiClient = ApiClient.getInstance();

  private constructor() {}

  public static getInstance(): ArtifactManager {
    if (!ArtifactManager.instance) {
      ArtifactManager.instance = new ArtifactManager();
    }
    return ArtifactManager.instance;
  }

  public createArtifact(options: CreateArtifactOptions): Artifact {
    const artifact: Artifact = {
      id: generateId('art'),
      taskId: options.taskId,
      agentId: options.agentId,
      missionId: options.missionId,
      type: options.type,
      title: options.title,
      content: options.content,
      createdAt: Date.now(),
      metadata: options.metadata,
    };

    this.artifacts.set(artifact.id, artifact);

    // Emit event for real-time visualization & activity feed
    EventBus.emit({
      id: generateId('ev_art'),
      type: 'artifact.created',
      timestamp: artifact.createdAt,
      message: `Artifact generated [${artifact.type}]: "${artifact.title}" by ${artifact.agentId.toUpperCase()}`,
      artifact,
    } as any);

    // Asynchronously sync to server database
    this.apiClient.post('/api/artifacts', artifact).catch(() => {});

    return artifact;
  }

  public getById(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  public getByTaskId(taskId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter((a) => a.taskId === taskId);
  }

  public getByAgentId(agentId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter((a) => a.agentId === agentId);
  }

  public getByMissionId(missionId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter((a) => a.missionId === missionId);
  }

  public getAll(): Artifact[] {
    return Array.from(this.artifacts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public clear(): void {
    this.artifacts.clear();
  }
}
