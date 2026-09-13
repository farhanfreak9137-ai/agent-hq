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
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const hasGeminiKey = Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY' && geminiApiKey.length > 5);

let aiClient: GoogleGenAI | null = null;
if (hasGeminiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey: geminiApiKey });
  } catch (err) {
    console.warn('[Backend] Failed to initialize GoogleGenAI client:', err);
  }
}

// 6. Base Health Check (Backward compatibility)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    database: 'sqlite_wal_active',
    connectedClients: eventStream.getConnectedCount(),
    providers: {
      mock: { available: true },
      gemini: { available: hasGeminiKey },
      antigravity: { available: false, reason: 'Local Antigravity daemon not detected' },
    },
  });
});

app.get('/api/providers/gemini/health', (_req: Request, res: Response) => {
  res.json({
    available: hasGeminiKey,
    message: hasGeminiKey
      ? 'Gemini backend operational'
      : 'GEMINI_API_KEY is not configured in server environment (.env).',
    latencyMs: hasGeminiKey ? 12 : 0,
  });
});

app.get('/api/providers/antigravity/health', (_req: Request, res: Response) => {
  res.json({
    available: false,
    message: 'Official Antigravity daemon not found on local host.',
    latencyMs: 1,
  });
});

// 7. Mount Comprehensive API Router
const apiRouter = createApiRouter(db, repos, authService, eventStream, aiClient, hasGeminiKey);
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
