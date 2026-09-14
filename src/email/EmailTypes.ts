export interface ExecutiveEmail {
  id: string;
  fromName: string;
  fromAddress: string;
  toName: string;
  toAddress: string;
  subject: string;
  preview: string;
  body: string;
  timestamp: number;
  read: boolean;
  starred?: boolean;
  category: 'mission_report' | 'task_report' | 'security' | 'general' | 'system';
  agentId?: string;
  taskId?: string;
  missionId?: string;
  deliverables?: { name: string; type: string; content?: string }[];
}

export const AGENT_DIRECTORY: Record<string, { name: string; role: string; email: string; avatarColor: string; symbol: string }> = {
  boss: {
    name: 'BOSS',
    role: 'Executive Director',
    email: 'boss.director@agenthq.corp',
    avatarColor: '#3b82f6',
    symbol: '👑',
  },
  nova: {
    name: 'NOVA',
    role: 'Chief Software Architect',
    email: 'nova.architect@agenthq.corp',
    avatarColor: '#10b981',
    symbol: '💻',
  },
  atlas: {
    name: 'ATLAS',
    role: 'Lead Research Analyst',
    email: 'atlas.researcher@agenthq.corp',
    avatarColor: '#06b6d4',
    symbol: '🔍',
  },
  sentinel: {
    name: 'SENTINEL',
    role: 'Principal Security Officer',
    email: 'sentinel.security@agenthq.corp',
    avatarColor: '#ef4444',
    symbol: '🛡️',
  },
  pixel: {
    name: 'PIXEL',
    role: 'Head of Product Design',
    email: 'pixel.designer@agenthq.corp',
    avatarColor: '#f59e0b',
    symbol: '🎨',
  },
  vector: {
    name: 'VECTOR',
    role: 'Staff QA & Reliability Engineer',
    email: 'vector.qa@agenthq.corp',
    avatarColor: '#8b5cf6',
    symbol: '⚡',
  },
  echo: {
    name: 'ECHO',
    role: 'Lead Documentation & Comms',
    email: 'echo.comms@agenthq.corp',
    avatarColor: '#6366f1',
    symbol: '📝',
  },
};

export const COMMANDER_EMAIL = 'commander@agenthq.corp';
export const COMMANDER_NAME = 'Commander';
