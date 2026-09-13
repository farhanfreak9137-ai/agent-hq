import Database from 'better-sqlite3';
import { UserRepository } from './UserRepository.ts';
import { AgentRepository } from './AgentRepository.ts';
import { TaskRepository } from './TaskRepository.ts';
import { MissionRepository } from './MissionRepository.ts';
import { MessageRepository } from './MessageRepository.ts';
import { MemoryRepository } from './MemoryRepository.ts';
import { EventRepository } from './EventRepository.ts';
import { AuditRepository } from './AuditRepository.ts';
import { ProviderConfigRepository } from './ProviderConfigRepository.ts';
import { ArtifactRepository } from './ArtifactRepository.ts';

export * from './UserRepository.ts';
export * from './AgentRepository.ts';
export * from './TaskRepository.ts';
export * from './MissionRepository.ts';
export * from './MessageRepository.ts';
export * from './MemoryRepository.ts';
export * from './EventRepository.ts';
export * from './AuditRepository.ts';
export * from './ProviderConfigRepository.ts';
export * from './ArtifactRepository.ts';

export interface Repositories {
  users: UserRepository;
  agents: AgentRepository;
  tasks: TaskRepository;
  missions: MissionRepository;
  messages: MessageRepository;
  memory: MemoryRepository;
  events: EventRepository;
  audit: AuditRepository;
  providers: ProviderConfigRepository;
  artifacts: ArtifactRepository;
}

export function createRepositories(db: Database.Database): Repositories {
  return {
    users: new UserRepository(db),
    agents: new AgentRepository(db),
    tasks: new TaskRepository(db),
    missions: new MissionRepository(db),
    messages: new MessageRepository(db),
    memory: new MemoryRepository(db),
    events: new EventRepository(db),
    audit: new AuditRepository(db),
    providers: new ProviderConfigRepository(db),
    artifacts: new ArtifactRepository(db),
  };
}
