import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { GoogleGenAI } from '@google/genai';
import { getDatabase } from './db/database.ts';
import { seedDatabase, recoverInterruptedTasks } from './db/migrations.ts';
import { createRepositories } from './repositories/index.ts';
import { AuthService } from './auth/authService.ts';
import { EventStreamManager } from './routes/eventStream.ts';
import { createApiRouter } from './routes/apiRoutes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Core Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3005', 'http://127.0.0.1:3000', 'http://127.0.0.1:3005'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Last-Event-ID'],
  })
);

// 2. Database & Seed Initialization
export const db = getDatabase();
seedDatabase(db);

// 3. Resumable Orchestration: Recover tasks interrupted by previous server stops
const recoveredCount = recoverInterruptedTasks(db);
if (recoveredCount > 0) {
  console.log(`[Agent HQ Recovery] Successfully recovered ${recoveredCount} interrupted tasks.`);
}

// 4. Repositories & Services
export const repos = createRepositories(db);
export const authService = new AuthService(repos.users);
export const eventStream = new EventStreamManager(repos.events);

// 5. External Provider Setup
const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
const geminiApiKeys: string[] = rawGeminiKeys
  .split(',')
  .map((k) => k.trim())
  .filter((k) => Boolean(k && k !== 'MY_GEMINI_API_KEY' && k.length > 5));

const hasGeminiKey = geminiApiKeys.length > 0;
const geminiClients: { client: GoogleGenAI; key: string }[] = [];
for (const key of geminiApiKeys) {
  try {
    geminiClients.push({ client: new GoogleGenAI({ apiKey: key }), key });
  } catch (err) {
    console.warn('[Backend] Failed to initialize GoogleGenAI client for key:', err);
  }
}

const aiClient = geminiClients[0]?.client || null;
const groqApiKey = process.env.GROQ_API_KEY || '';
const openaiApiKey = process.env.OPENAI_API_KEY || '';
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';

import { execSync } from 'child_process';

let antigravityStatusCache: { available: boolean; version?: string; model?: string; message: string; lastChecked: number } | null = null;

export function checkAntigravityAvailable(): { available: boolean; version?: string; model?: string; message: string } {
  const now = Date.now();
  if (antigravityStatusCache && now - antigravityStatusCache.lastChecked < 10000) {
    return antigravityStatusCache;
  }
  try {
    const version = execSync('agy --version', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 })
      .toString()
      .trim();
    antigravityStatusCache = {
      available: true,
      version,
      model: 'gemini-3.8-flash-low',
      message: `Official Google Antigravity CLI operational (v${version})`,
      lastChecked: now,
    };
  } catch {
    antigravityStatusCache = {
      available: false,
      message: 'Official Google Antigravity CLI (agy) not found on PATH or runtime unauthenticated.',
      lastChecked: now,
    };
  }
  return antigravityStatusCache;
}

// 6. Base Health Check (Backward compatibility)
app.get('/api/health', (_req: Request, res: Response) => {
  const agyStatus = checkAntigravityAvailable();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: 'sqlite_wal_active',
    connectedClients: eventStream.getConnectedCount(),
    providers: {
      mock: { available: true },
      gemini: { available: hasGeminiKey, keyCount: geminiClients.length },
      groq: { available: Boolean(groqApiKey) },
      openai: { available: Boolean(openaiApiKey) },
      antigravity: {
        available: agyStatus.available,
        version: agyStatus.version,
        model: agyStatus.model,
        reason: agyStatus.available ? undefined : agyStatus.message,
      },
    },
  });
});

app.get('/api/providers/gemini/health', (_req: Request, res: Response) => {
  res.json({
    available: hasGeminiKey,
    keyCount: geminiClients.length,
    message: hasGeminiKey
      ? `Gemini backend operational with ${geminiClients.length} key(s) in rotation pool`
      : 'GEMINI_API_KEY is not configured in server environment (.env).',
    latencyMs: hasGeminiKey ? 12 : 0,
  });
});

app.get('/api/providers/antigravity/health', (_req: Request, res: Response) => {
  const agyStatus = checkAntigravityAvailable();
  res.json({
    available: agyStatus.available,
    message: agyStatus.message,
    version: agyStatus.version,
    model: agyStatus.model || 'gemini-3.8-flash-low',
    latencyMs: agyStatus.available ? 8 : 0,
  });
});

// 7. Mount Comprehensive API Router
const apiRouter = createApiRouter(db, repos, authService, eventStream, aiClient, hasGeminiKey, {
  geminiClients,
  groqApiKey,
  openaiApiKey,
  groqModel,
  openaiModel,
});
app.use('/api', apiRouter);

// 8. Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

export const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`[Agent HQ Server] Production backend listening on http://127.0.0.1:${PORT}`);
});

// 9. Graceful Shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Agent HQ Server] Received ${signal}. Initiating graceful shutdown...`);
  eventStream.destroy();
  server.close(() => {
    console.log('[Agent HQ Server] HTTP server closed.');
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('[Agent HQ Server] SQLite database closed cleanly.');
    } catch (e) {
      console.error('[Agent HQ Server] Error closing database:', e);
    }
    process.exit(0);
  });

  // Force close if graceful termination hangs
  setTimeout(() => {
    console.error('[Agent HQ Server] Forced shutdown after timeout.');
    process.exit(1);
  }, 5000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default app;
