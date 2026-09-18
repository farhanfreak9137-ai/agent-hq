/**
 * SQLite Database Schema Definition for Agent HQ
 * Phase 3A: Production Infrastructure, Persistence & Security
 */

export const SCHEMA_SQL = `
-- 1. Users & Authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'USER')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Agents
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  system_directive TEXT NOT NULL,
  provider_id TEXT NOT NULL DEFAULT 'mock',
  status TEXT NOT NULL DEFAULT 'IDLE',
  capabilities TEXT NOT NULL, -- JSON array of capabilities
  assigned_tools TEXT NOT NULL, -- JSON array of tool IDs
  current_room_id TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  stats TEXT NOT NULL, -- JSON stats
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 3. Missions / Initiatives
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  total_nodes INTEGER NOT NULL DEFAULT 0,
  completed_nodes INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  error TEXT,
  started_at INTEGER,
  completed_at INTEGER
);

-- 4. Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  mission_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ASSIGNED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED', 'INTERRUPTED')),
  assigned_agent_id TEXT,
  provider_id TEXT DEFAULT 'mock',
  execution_mode TEXT DEFAULT 'mock' CHECK(execution_mode IN ('real', 'mock')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  result TEXT, -- JSON output/summary
  error TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- 5. Task Dependencies (DAG edges)
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL,
  depends_on_task_id TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_task_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 6. Task Executions (Audit history of all attempts)
CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  execution_mode TEXT NOT NULL DEFAULT 'mock',
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'interrupted', 'timed_out')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,
  summary TEXT,
  output TEXT,
  tools_used TEXT, -- JSON array
  error TEXT,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- 7. Messages (Inter-agent communication)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  task_id TEXT,
  timestamp INTEGER NOT NULL,
  payload TEXT -- JSON extra data (handovers, etc)
);

-- 8. Durable Agent Memory
CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  session_id TEXT,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT, -- JSON
  timestamp INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 9. Provider Configuration (Safe metadata only; NEVER store API keys/secrets in DB)
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  max_concurrency INTEGER NOT NULL DEFAULT 4,
  models TEXT NOT NULL, -- JSON array of supported model strings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 10. Lifecycle Events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  message TEXT NOT NULL,
  agent_id TEXT,
  task_id TEXT,
  mission_id TEXT,
  metadata TEXT -- JSON
);

-- 11. Security Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  metadata TEXT, -- JSON
  timestamp INTEGER NOT NULL
);

-- 12. Verifiable Deliverable Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  mission_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  metadata TEXT
);

-- 13. CRM Prospects Lifecycle
CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  domain TEXT,
  contact_name TEXT,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  opportunity TEXT,
  recommended_service TEXT,
  fit TEXT DEFAULT 'medium',
  priority TEXT DEFAULT 'medium',
  research_notes TEXT, -- JSON array
  interactions TEXT, -- JSON array of interactions
  draft_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT -- JSON
);

-- 14. Outreach Drafts
CREATE TABLE IF NOT EXISTS outreach_drafts (
  id TEXT PRIMARY KEY,
  prospect_id TEXT,
  company TEXT,
  recipient TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  personalization_points TEXT NOT NULL, -- JSON array
  source_evidence TEXT NOT NULL, -- JSON array
  confidence REAL NOT NULL DEFAULT 0.8,
  requires_human_approval INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFTED',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT,
  review_notes TEXT,
  approved_at INTEGER,
  approved_by TEXT,
  rejection_reason TEXT,
  sent_at INTEGER,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL
);

-- 15. Farhan Professional Profile
CREATE TABLE IF NOT EXISTS professional_profile (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL, -- JSON document of ProfessionalProfile
  version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 16. Profile Improvement Suggestions from Agents (Must be confirmed by Farhan)
CREATE TABLE IF NOT EXISTS profile_suggestions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  section TEXT NOT NULL,
  proposed_change TEXT NOT NULL, -- JSON
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT
);

-- 17. Opportunity HQ Pipeline
CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  location TEXT NOT NULL,
  remote INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  requirements TEXT NOT NULL, -- JSON array of strings
  eligibility TEXT NOT NULL, -- JSON array of strings
  deadline TEXT,
  discovered_at INTEGER NOT NULL,
  matched_skills TEXT, -- JSON array of strings
  missing_skills TEXT, -- JSON array of strings
  evidence TEXT, -- JSON array of strings
  fit_analysis TEXT, -- JSON record
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  application_draft_id TEXT,
  source_verification TEXT NOT NULL DEFAULT 'UNVERIFIED',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 18. Tailored Job & Internship Applications
CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  target_organization TEXT NOT NULL,
  opportunity_title TEXT NOT NULL,
  selected_profile_info TEXT NOT NULL, -- JSON
  tailored_resume TEXT NOT NULL, -- JSON
  application_message TEXT NOT NULL,
  missing_info TEXT NOT NULL, -- JSON array
  potential_risks TEXT NOT NULL, -- JSON array
  status TEXT NOT NULL DEFAULT 'DRAFTED' CHECK(status IN ('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'SUBMITTED')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  approved_at INTEGER,
  approved_by TEXT,
  rejection_reason TEXT,
  submitted_at INTEGER,
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

-- 19. Gmail Integration & SMTP Config
CREATE TABLE IF NOT EXISTS email_integration_config (
  id TEXT PRIMARY KEY,
  gmail_address TEXT NOT NULL,
  app_password TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT 'Md Farhan Hossain',
  stagger_delay_seconds INTEGER NOT NULL DEFAULT 20,
  auto_send_enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 20. Staged & Dispatched Outreach Emails
CREATE TABLE IF NOT EXISTS outreach_emails (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  attachments TEXT, -- JSON array of file paths
  status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged', 'sending', 'sent', 'failed')),
  error_message TEXT,
  sent_at INTEGER,
  created_at INTEGER NOT NULL
);

-- 21. Recruiter & Company Incoming Replies
CREATE TABLE IF NOT EXISTS incoming_replies (
  id TEXT PRIMARY KEY,
  outreach_email_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  company TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  intent TEXT NOT NULL DEFAULT 'general' CHECK(intent IN ('interview_invite', 'question', 'rejection', 'general')),
  drafted_reply TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'staged', 'replied', 'archived')),
  received_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 22. Mobile & Webhook Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'discord' CHECK(channel IN ('discord', 'none')),
  discord_webhook_url TEXT NOT NULL DEFAULT '',
  is_enabled INTEGER NOT NULL DEFAULT 1,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 5,
  updated_at INTEGER NOT NULL
);

-- INDEXES for fast operational queries
CREATE INDEX IF NOT EXISTS idx_tasks_mission_id ON tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_task_deps_dep ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_messages_source ON messages(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_target ON messages(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_memory_agent_time ON memory_entries(agent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_mission ON events(mission_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_task ON artifacts(task_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_agent ON artifacts(agent_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_mission ON artifacts(mission_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_prospect ON outreach_drafts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON outreach_drafts(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_org ON opportunities(organization);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(type);
CREATE INDEX IF NOT EXISTS idx_job_apps_opp ON job_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_status ON outreach_emails(status);
CREATE INDEX IF NOT EXISTS idx_outreach_emails_created ON outreach_emails(created_at);
CREATE INDEX IF NOT EXISTS idx_incoming_replies_status ON incoming_replies(status);
CREATE INDEX IF NOT EXISTS idx_incoming_replies_intent ON incoming_replies(intent);
CREATE INDEX IF NOT EXISTS idx_incoming_replies_time ON incoming_replies(received_at);
`;


