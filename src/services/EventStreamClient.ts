import { EventBus } from '../events/EventBus.ts';

export type StreamConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

export class EventStreamClient {
  private static instance: EventStreamClient | null = null;
  private eventSource: EventSource | null = null;
  private status: StreamConnectionStatus = 'disconnected';
  private reconnectDelayMs: number = 1000;
  private maxReconnectDelayMs: number = 16000;
  private reconnectTimeout: any = null;
  private processedEventIds: Set<string> = new Set();
  private lastEventId: string | null = null;
  private statusListeners: Set<(status: StreamConnectionStatus) => void> = new Set();

  public static getInstance(): EventStreamClient {
    if (!EventStreamClient.instance) {
      EventStreamClient.instance = new EventStreamClient();
    }
    return EventStreamClient.instance;
  }

  public connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource) {
      return;
    }

    this.setStatus('connecting');
    const url = '/api/events';

    try {
      this.eventSource = new EventSource(url, { withCredentials: true });

      this.eventSource.onopen = () => {
        this.setStatus('connected');
        this.reconnectDelayMs = 1000; // Reset backoff on success
      };

      this.eventSource.onmessage = (event) => {
        if (!event.data) return;

        try {
          const parsed = JSON.parse(event.data);
          if (event.lastEventId) {
            this.lastEventId = event.lastEventId;
            if (this.processedEventIds.has(event.lastEventId)) {
              return; // Duplicate protection
            }
            this.processedEventIds.add(event.lastEventId);
            if (this.processedEventIds.size > 500) {
              const arr = Array.from(this.processedEventIds);
              this.processedEventIds = new Set(arr.slice(arr.length - 250));
            }
          }

          // If it's an Agent HQ event, dispatch to EventBus
          if (parsed.type && parsed.type !== 'stream.connected' && parsed.type !== 'ping') {
            EventBus.emit(parsed);
          }
        } catch {
          // Ignore malformed event frames
        }
      };

      this.eventSource.onerror = () => {
        this.disconnect();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.setStatus('reconnecting');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maxReconnectDelayMs);
      this.connect();
    }, this.reconnectDelayMs);
  }

  public disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setStatus('disconnected');
  }

  public getStatus(): StreamConnectionStatus {
    return this.status;
  }

  public onStatusChange(listener: (status: StreamConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: StreamConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      for (const listener of this.statusListeners) {
        listener(status);
      }
    }
  }
}
