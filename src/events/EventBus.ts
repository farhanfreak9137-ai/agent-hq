import { SimulationEvent, SimulationEventType } from './EventTypes.ts';

type Listener<T extends SimulationEvent = SimulationEvent> = (event: T) => void;

class EventBusClass {
  private listeners: Map<SimulationEventType | '*', Set<Listener<SimulationEvent>>> = new Map();
  private history: SimulationEvent[] = [];
  private readonly maxHistory = 300;

  public on<T extends SimulationEvent = SimulationEvent>(
    eventType: SimulationEventType | '*',
    listener: Listener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener as Listener<SimulationEvent>);

    return () => {
      this.off(eventType, listener);
    };
  }

  public off<T extends SimulationEvent = SimulationEvent>(
    eventType: SimulationEventType | '*',
    listener: Listener<T>
  ): void {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(listener as Listener<SimulationEvent>);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  public emit<T extends SimulationEvent>(event: T): void {
    // Record history
    this.history.unshift(event);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    // Specific listeners
    const specificListeners = this.listeners.get(event.type);
    if (specificListeners) {
      specificListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error(`Error in event listener for ${event.type}:`, err);
        }
      });
    }

    // Wildcard listeners
    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('Error in wildcard event listener:', err);
        }
      });
    }
  }

  public getHistory(): SimulationEvent[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
  }
}

export const EventBus = new EventBusClass();
