import { Request, Response } from 'express';
import { EventRepository, EventEntity } from '../repositories/EventRepository.ts';

interface SSEClient {
  id: string;
  res: Response;
  lastEventTime: number;
}

export class EventStreamManager {
  private clients: Map<string, SSEClient> = new Map();

  constructor(private eventRepo: EventRepository) {}

  public handleConnection(req: Request, res: Response): void {
    const clientId = `sse_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const client: SSEClient = {
      id: clientId,
      res,
      lastEventTime: Date.now(),
    };

    this.clients.set(clientId, client);

    // Initial connection ack
    res.write(`data: ${JSON.stringify({ type: 'stream.connected', clientId, timestamp: Date.now() })}\n\n`);

    // Handle optional Last-Event-ID or replay recent events on reconnect
    const lastEventId = req.headers['last-event-id'] as string;
    if (lastEventId) {
      const recent = this.eventRepo.getRecent(20);
      for (const ev of recent) {
        res.write(`id: ${ev.id}\ndata: ${JSON.stringify(ev)}\n\n`);
      }
    }

    req.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  public broadcast(event: EventEntity): void {
    // Persist event to DB
    this.eventRepo.save(event);

    // Stream to all connected clients
    const payload = `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(id);
      }
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public destroy(): void {
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch {
        // Ignore socket errors during termination
      }
    }
    this.clients.clear();
  }
}
